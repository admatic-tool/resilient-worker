"use strict"

const uuidv4 = require("uuid/v4")
const { EventEmitter } = require("events")
const co = require("co")

const Broker = require("./brokers/rabbit")
const wait = milisseconds =>
  new Promise(resolve => setTimeout(resolve, milisseconds))

const WorkerFactory = connectUrl => {

  // return workerFactory
  return {

    createWorker(config) {
      const emitter =  new EventEmitter()
      const broker = new Broker(connectUrl, emitter, config)

      const { callback, name, successCallback, failCallback, max_try, retry_timeout } = config

      const worker = {

        on(event, callback) {
          emitter.on(event, callback)
        },

        start: co.wrap(function*() {

          broker.consume(msg => {

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

                    broker.requeue(message, messageId, try_count)

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
                  emitter.emit("fail", msg)
                }
              } catch(err) {
                emitter.emit("log", "error", name, messageId, try_count, err)
                emitter.emit("fail", msg)
              }
            })
          })

        }) // end start
      }

      return {
        worker,
        publish: broker.publish,
      }
    }
  }
}

module.exports = WorkerFactory
