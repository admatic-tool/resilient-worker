"use strict"

const amqplib = require("amqplib")
const co = require("co")

module.exports = class RabbitBroker {

  constructor(connectUrl, emitter,  opts = {}) {
    this.opts = opts
    this.connectUrl = connectUrl
    this.emitter = emitter

    this.conn = amqplib.connect(connectUrl)
    this.getChannel = co.wrap(this.getChannel.bind(this))
    this.publish = co.wrap(this.publish.bind(this))
    this.requeue = co.wrap(this.requeue.bind(this))
    this._assertQueue = co.wrap(this._assertQueue.bind(this))

    this.consume = co.wrap(this.consume.bind(this))
  }

  _assertQueue(ch) {
    const { queue, queueOptions } = this.opts

    if (queue || queueOptions)
      return queueOptions ? ch.assertQueue(queue, queueOptions) : ch.checkQueue(queue)
    else
      return true
  }

  *getChannel() {

    const { queue } = this.opts

    try {
      const conn = yield this.conn
      const ch = yield conn.createChannel()
      const ok = yield this._assertQueue(ch)

      if (ok) {
        return ch
      } else {
        ch.close()
        throw new Error(`queue not match ${queue}`)
      }
    } catch(err) {
      throw err
    }
  }

  *publish(message) {

    const { opts, emitter } = this
    const { queue, publishIn = {}, name } = opts

    const { routingKey, exchange } = publishIn
    const ch = yield this.getChannel()
    debugger
    try {
      if (exchange && routingKey)
        ch.publish(exchange, routingKey, new Buffer(JSON.stringify(message)))
      else if (queue)
        ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))
      else
        throw new Error("no exchange & routingKey specified or a simple queue")

      emitter.emit("log", "debug", name, "publishing", message)

      ch.close()

      return true

    } catch(err) {

      ch.close()
      throw err
    }
  }

  *requeue(message, executionId, try_count) {
    const { opts, emitter } = this

    const { queue, name } = opts

    const ch = yield this.getChannel()

    try {


      ch.sendToQueue(
        queue,
        new Buffer(JSON.stringify(message)),
        {
          headers: {
            try_count: try_count + 1
          },
          messageId: executionId,
        }
      )
      emitter.emit("log", "debug", name, executionId, try_count, "publishing", message)

      ch.close()

      return true

    } catch(err) {

      ch.close()
      throw err
    }
  }

  ack() {

  }

  *consume(callback) {
    const { emitter } = this
    const { queue, prefetch = 1 } = this.opts
    const ch = yield this.getChannel()



    ch.prefetch(prefetch)

    emitter.on("fail", msg => {
      ch.ack(msg)
    })

    ch.consume(queue, msg => {
      callback(msg)
    })
  }
}
