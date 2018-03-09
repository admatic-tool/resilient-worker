"use strict"

const co = require("co")
const amqplib = require("amqp-connection-manager")
const uuidv4 = require("uuid/v4")
const { EventEmitter } = require("events")
const emitter = new EventEmitter()


const wait = milisseconds =>
  new Promise(resolve => setTimeout(resolve, milisseconds))


const WorkerFactory = (connectUrl, opts = {}) => {

  const _conn = amqplib.connect([ connectUrl ])


  // return workerFactory
  return {

    createWorker(meta) {

      const {
        name,
        max_try = 1, retry_timeout,
        callback, failCallback, successCallback,
        queue, publishIn = {}, prefetch = 1,
        queueOptions = {}
      } = meta

      const { exchange, routingKey } = publishIn

      const requeue = co.wrap(function*(message, executionId, try_count) {
        const conn = _conn
        const ch = conn.createChannel()

        try {

          yield ch.sendToQueue(
            queue,
            new Buffer(JSON.stringify(message)),
            {
              headers: {
                try_count: try_count + 1,
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
      })

      const publish = co.wrap(function*(message) {

        const conn = _conn
        const ch = conn.createChannel()

        try {
          if (exchange && routingKey)
            yield ch.publish(exchange, routingKey, new Buffer(JSON.stringify(message)))
          else if (queue)
            yield ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))
          else
            throw new Error("no exchange & routingKey specified or a simple queue")

          emitter.emit("log", "debug", name, "publishing", message)

          ch.close()

          return true

        } catch(err) {

          ch.close()
          throw err
        }
      })

      const worker = {

        on(event, callback) {
          emitter.on(event, callback)
        },

        start: co.wrap(function*() {

          const conn = _conn
          const ch = conn.createChannel({
            setup: channel => {

              channel.prefetch(prefetch)
              channel.assertQueue(queue, queueOptions)
              channel.consume(queue, msg => {
                if (msg === null) {
                  emitter.emit("log", "debug", name, "cancelled")
                  return
                }
  
                const { properties } = msg
                const {
                  messageId = uuidv4(),
                  headers
                } = properties
  
                const { try_count = 1 } = headers
  
                co(function*() {
  
                  try {
  
                    const message = JSON.parse(msg.content.toString())
  
                    try {
                      emitter.emit("log", "debug", name, messageId, try_count,  "try callback")
  
                      yield callback(message)
  
                      if (successCallback) {
  
                        successCallback(message)
                          .then(res =>
                            emitter.emit("log", "debug", name, messageId, try_count,  "success callback", res)
                          )
                          .catch(err =>
                            emitter.emit("log", "debug", name, messageId, try_count, "error callback", err)
                          )
                      }
  
                    } catch(err) {
                      emitter.emit("log", "error", name, messageId, try_count, "try fail", err)
  
                      if (try_count < max_try) {
  
                        /* smoth the retry process */
                        if (retry_timeout)
                          yield wait(retry_timeout).catch(err =>
                            emitter.emit(
                              "log", "error", name, messageId, try_count, "fail retry timeout", err
                            )
                          )
  
                        requeue(message, messageId, try_count)
  
                      } else {
  
                        if (failCallback)
                          failCallback(message)
                          .then(res =>
                            emitter.emit(
                              "log", "debug", name, messageId, try_count, "fail callback", res
                            )
                          )
                          .catch(err =>
                            emitter.emit(
                              "log", "error", name, messageId, try_count, "fail callback", err
                            )
                          )
                      }
  
                    } finally {
                      ch.ack(msg)
                    }
                  } catch(err) {
                    emitter.emit("log", "error", name, messageId, try_count, err)
                    ch.ack(msg)
                  }
                })
              })

            }
          })
        }) // end start
      }

      return { worker, publish, emitter }
    }
  }
}

module.exports = WorkerFactory
