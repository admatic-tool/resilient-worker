"use strict"

const uuidv4 = require("uuid/v4")
const { EventEmitter } = require("events")
const co = require("co")

const brokers = {
  rabbit: "./brokers/rabbit",
  sqs: "./brokers/sqs",
}

const wait = milisseconds =>
  new Promise(resolve => setTimeout(resolve, milisseconds))

const WorkerFactory = {

  createWorker(config) {

    const { broker = "rabbit" } = config

    const BrokerClass = require(brokers[broker])
    const emitter =  new EventEmitter()
    const _broker = new BrokerClass(config, emitter)

    const { callback, name, successCallback, failCallback, max_try, retry_timeout } = config

    const worker = {

      on(event, callback) {
        emitter.on(event, callback)
      },

      start: co.wrap(function*() {

        _broker.consume(msg => {

          if (msg === null) {
            emitter.emit("log", "debug", name, "cancelled")
            return
          }

          const messageId = msg.messageId()

          co(function*() {

            try {

              const doc = msg.parsedContent()

              try {
                emitter.emit("log", "debug", name, messageId, msg.count(), "try callback")

                yield callback(doc)

                if (successCallback) {

                  successCallback(doc, msg)
                    .then(res =>
                      emitter.emit("log", "debug", name, messageId, msg.count(), "success callback", res)
                    )
                    .catch(err =>
                      emitter.emit("log", "debug", name, messageId, msg.count(), "error callback", err)
                    )
                }

              } catch(err) {

                emitter.emit("log", "error", name, messageId, msg.count(), "try fail", err)

                if (msg.count() < max_try) {

                  /* smoth the retry process */
                  if (retry_timeout)
                    yield wait(retry_timeout).catch(err =>
                      emitter.emit(
                        "log", "error", name, messageId, msg.count(), "fail retry timeout", err
                      )
                    )
                    _broker.requeue(doc, messageId, msg.nextCount())
                          .then(
                            emitter.emit("log", "debug", name, messageId, msg.nextCount(), "requeued")
                          )
                          .catch(err =>
                            emitter.emit("log", "error", name, messageId, msg.nextCount(), "requeue error", err)
                          )
                } else {
                  if (failCallback)
                    failCallback(doc, err, msg)
                    .then(res =>
                      emitter.emit("log", "debug", name, messageId, msg.count(), "fail callback", res)
                    )
                    .catch(err =>
                      emitter.emit("log", "error", name, messageId, msg.count(), "fail callback", err)
                    )
                }

              } finally {
                emitter.emit("fail", msg)
              }
            } catch(err) {
              emitter.emit("log", "error", name, messageId, msg.count(), err)
              emitter.emit("fail", msg)
            }
          })
        })

      }) // end start
    }

    return {
      worker,
      publish: doc => _broker.publish(doc, uuidv4(), 1)
    }
  }
}

module.exports = WorkerFactory
