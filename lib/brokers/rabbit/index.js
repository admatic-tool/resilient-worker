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
  }

  _validate(opts) {
    if (opts.validate === false)
      return opts
    else {
      const errors = []

      if (!opts.connectUrl)
        errors.push({ connectUrl: "not defined"})

      if (!opts.callback)
        errors.push({ callback: "not defined"})

      if (errors.length > 0)
        throw new Error(errors.join(","))

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

    const { queue } = this.opts

    try {
      const conn = yield this.conn
      const ch = yield conn.createChannel()
      const ok = yield this._assertQueue(ch)

      if (ok)
        return ch
      else {
        ch.close()
        throw new Error(`queue not match ${queue}`)
      }
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
      else if (queue)
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
      try {
        ch.sendToQueue(
          queue,
          msg.getBufferContent(),
          {
            headers: {
              try_count: msg.nextCount(),
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
    const { queue, bulkSize } = this.opts
    const ch = yield this._getChannel()

    ch.prefetch(bulkSize)

    ch.consume(queue, msg => {
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
  }
}
