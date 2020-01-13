const amqplib = require('amqplib')

const co = require('co')
const Message = require('../../messages/message')

module.exports = class RabbitBroker {
  constructor(opts = {}) {
    this.opts = this._validate(opts)

    this._newChannel = co.wrap(this._newChannel.bind(this))
    this._getPublisherChannel = co.wrap(this._getPublisherChannel.bind(this))

    this.publish = co.wrap(this.publish.bind(this))
    this.requeue = co.wrap(this.requeue.bind(this))

    this._assertQueue = co.wrap(this._assertQueue.bind(this))

    this.consume = co.wrap(this.consume.bind(this))
    this.stop = co.wrap(this.stop.bind(this))

    this._reconnect = this._reconnect.bind(this)

    this._consumerTag = null
    this._consumerChannel = null

    this._publisherChannel = null

    this._handleConsumerEvents = this._handleConsumerEvents.bind(this)
  }

  // eslint-disable-next-line class-methods-use-this
  _validate(opts) {
    if (opts.validate === false) return opts

    const errors = []

    if (!opts.connectUrl) errors.push('connectUrl is not defined')

    if (!opts.callback) errors.push('callback is not defined')

    if (opts.publishIn) {
      const { routingKey, exchange } = opts.publishIn
      if (!exchange) {
        errors.push('exchange is not defined')
      }

      if (!routingKey) {
        errors.push('routingKey is not defined')
      }
    }

    if (errors.length > 0) throw new Error(errors.join(', '))

    return opts
  }

  _assertQueue(ch) {
    const { queue, queueOptions } = this.opts

    if (queue || queueOptions)
      return queueOptions
        ? ch.assertQueue(queue, queueOptions)
        : ch.checkQueue(queue)
    return true
  }

  *_newChannel() {
    try {
      const conn = yield amqplib.connect(this.opts.connectUrl)

      return conn.createChannel().then(ch => {
        console.log('New channel created.')
        return ch
      })
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  _getPublisherChannel() {
    if (!this._publisherChannel) {
      this._publisherChannel = this._newChannel()
        .then(ch => {
          ch.on('close', () => {
            this._publisherChannel = null
            console.log('Publisher channel closed.')
          })
          return ch
        })
        .catch(err => {
          this._publisherChannel = null
          throw err
        })
    }

    return this._publisherChannel
  }

  *publish(message, executionId, tryCount) {
    const { opts } = this
    const { queue, publishIn = {} } = opts

    const { routingKey, exchange } = publishIn

    const ch = yield this._getPublisherChannel()

    if (exchange && routingKey) {
      ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
        headers: {
          try_count: tryCount
        },
        messageId: executionId,
        persistent: true
      })
    } else if (queue) {
      const ok = yield this._assertQueue(ch)
      if (!ok) {
        throw new Error(`queue not match ${queue}`)
      }

      ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        headers: {
          try_count: tryCount
        },
        messageId: executionId,
        persistent: true
      })
    } else {
      throw new Error('no exchange & routingKey specified or a simple queue')
    }

    return true
  }

  *requeue(msg) {
    try {
      const { opts } = this

      const { queue } = opts

      const ch = yield this._getPublisherChannel()

      const ok = yield this._assertQueue(ch)
      if (!ok) throw new Error(`queue not match ${queue}`)

      ch.sendToQueue(queue, msg.getBufferContent(), {
        headers: {
          try_count: msg.nextTryCount()
        },
        messageId: msg.messageId(),
        persistent: true
      })

      return true
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  // eslint-disable-next-line class-methods-use-this
  remove(msg) {
    return Promise.resolve(msg._remove())
  }

  *consume(callback) {
    const { queue, prefetch } = this.opts

    if (this._consumerTag) {
      throw new Error(
        `Worker is already consuming queue ${queue}. consumer tag: ${
          this._consumerTag
        }`
      )
    }

    const ch = this._consumerChannel
      ? this._consumerChannel
      : yield this._newChannel()

    ch.prefetch(prefetch)

    return ch
      .consume(queue, msg => {
        let message = null

        if (msg)
          message = new Message(
            {
              messageId: msg.properties.messageId,
              count: msg.properties.headers.try_count,
              content: msg.content
            },
            {
              _remove() {
                return ch.ack(msg)
              }
            },
            msg
          )

        callback(message)
      })
      .then(result => {
        const { consumerTag } = result
        this._consumerTag = consumerTag
        this._consumerChannel = ch

        this._handleConsumerEvents(
          this._consumerChannel,
          this._consumerTag,
          callback
        )
      })
  }

  _handleConsumerEvents(consumerChannel, consumerTag, callback) {
    const conn = consumerChannel.connection

    conn.on('close', err => {
      if (err) {
        console.error(
          'Consumer connection closed. Broker message: ',
          err.message
        )

        if (this.opts.reconnectConsumer) {
          setTimeout(
            this._reconnect,
            this.opts.reconnectTimeoutSeconds * 1000,
            () => this.consume(callback),
            this.opts.reconnectTimeoutSeconds * 1000
          )
        }
      }

      console.error('Consumer connection close.')
    })

    conn.on('error', err => {
      console.error('Consumer connection error', err)
    })

    consumerChannel.on('error', err => {
      console.error('Consumer channel error: ', err)
    })

    consumerChannel.on('close', () => {
      console.error('Consumer channel close.')
      if (this._consumerTag === consumerTag) {
        this._consumerTag = null
      }

      if (this._consumerChannel === consumerChannel) {
        this._consumerChannel = null
      }
    })
  }

  _reconnect(retryFn, timeout) {
    console.log('Trying to reconnect consumer')
    return retryFn().catch(reconnectionError => {
      console.error(
        'Error while trying to reconnect consumer',
        reconnectionError
      )

      setTimeout(this._reconnect, timeout, retryFn, timeout)
    })
  }

  stop() {
    if (this._consumerTag && this._consumerChannel) {
      return this._consumerChannel
        .cancel(this._consumerTag)
        .then(() => {
          try {
            this._consumerChannel.close()
          } catch (err) {
            console.error(
              'Error trying to close consumer channel while stopping broker'
            )
          }

          try {
            this._consumerChannel.connection.close()
          } catch (err) {
            console.error(
              'Error trying to close consumer connection while stopping broker'
            )
          }

          this._consumerTag = null
          this._consumerChannel = null
        })
        .catch(err => {
          console.error(
            `Error when cancelling consumer tag ${this._consumerTag}`,
            err.message
          )
        })
    }
    return Promise.resolve(true)
  }
}
