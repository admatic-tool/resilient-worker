"use strict"

const amqplib = require("amqplib")
const co = require("co")
const Message = require("../../messages/message")

module.exports = class RabbitBroker {

  constructor(opts = {}) {
    this.opts = this._validate(opts)

    this.conn = amqplib.connect(opts.connectUrl)
    this._getChannel = co.wrap(this._getChannel.bind(this))
    this.publish = co.wrap(this.publish.bind(this))
    this.requeue = co.wrap(this.requeue.bind(this))
    this._assertQueue = co.wrap(this._assertQueue.bind(this))

    this.consume = co.wrap(this.consume.bind(this))
    this.stop = co.wrap(this.stop.bind(this))

    this._consumerTag = null
    this._consumerChannel = null
  }

  _validate(opts) {
    if (opts.validate === false)
      return opts
    else {
      const errors = []

      if (!opts.connectUrl)
        errors.push("connectUrl not defined")

      if (!opts.callback)
        errors.push("callback not defined")

      if (errors.length > 0)
        throw new Error(errors.join(", "))

      return opts
    }
  }

  _assertQueue(ch) {
    const { queue, queueOptions } = this.opts

    if (queue || queueOptions)
      return queueOptions ? ch.assertQueue(queue, queueOptions) : ch.checkQueue(queue)
    else
      return true
  }

  *_getChannel() {
    try {
      const conn = yield this.conn
      return conn.createChannel()
    } catch(err) {
      throw err
    }
  }

  *publish(message, executionId, try_count) {

    const { opts } = this
    const { queue, publishIn = {} } = opts

    const { routingKey, exchange } = publishIn
    const ch = yield this._getChannel()

    try {
      if (exchange && routingKey)
        ch.publish(exchange,
                   routingKey,
                   new Buffer(JSON.stringify(message)),
                   {
                     headers: {
                       try_count,
                     },
                     messageId: executionId,
                   }
        )
      else if (queue) {
        const ok = yield this._assertQueue(ch)
        if (!ok)
          throw new Error(`queue not match ${queue}`)

        ch.sendToQueue(
          queue,
          new Buffer(JSON.stringify(message)),
          {
            headers: {
              try_count,
            },
            messageId: executionId,
          }
        )
      }
      else
        throw new Error("no exchange & routingKey specified or a simple queue")


      ch.close()

      return true

    } catch(err) {

      ch.close()
      throw err
    }
  }

  *requeue(msg) {
    try {
      const { opts } = this

      const { queue } = opts
      const ch = yield this._getChannel()

      const ok = yield this._assertQueue(ch)
      if (!ok)
        throw new Error(`queue not match ${queue}`)

      try {
        ch.sendToQueue(
          queue,
          msg.getBufferContent(),
          {
            headers: {
              try_count: msg.nextTryCount(),
            },
            messageId: msg.messageId(),
          }
        )
        ch.close()

        return true

      } catch(err) {
        ch.close()
        throw err
      }
    } catch(err) {
      throw err
    }
  }


  remove(msg) {
    return Promise.resolve(msg._remove())
  }

  *consume(callback) {
    // debugger
    const { queue, prefetch } = this.opts

    if (this._consumerTag) {
      throw new Error(`Worker is already consuming queue ${queue}. consumer tag: ${this._consumerTag}`)
    }

    const ch = this._consumerChannel ?
      this._consumerChannel : yield this._getChannel()

    ch.prefetch(prefetch)

    return ch.consume(queue, msg => {
      let message = null

      if (msg)
        message = new Message({ messageId: msg.properties.messageId,
                                count: msg.properties.headers.try_count,
                                content: msg.content },
                              {
                                _remove() {
                                  return ch.ack(msg)
                                },
                              },
                              msg)

      callback(message)
    })
    .then(result => {
      const { consumerTag } = result
      this._consumerTag = consumerTag
      this._consumerChannel = ch
    })
  }

  stop() {
    if (this._consumerTag && this._consumerChannel) {
      return this._consumerChannel.cancel(this._consumerTag)
        .then(() => {
          this._consumerTag = this._consumerChannel = null
        })
    }
    return Promise.resolve(true)
  }
}
