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

      _log(level, msg, message, ...resources) {
        emitter.emit(...[ "log", name, level, msg, message, ...resources ])
      },

      start: co.wrap(function*() {

        const { _log: log } = this

        _broker.consume(msg => {

          if (msg === null) {
            log("debug", {}, "cancelled")
            return
          }

          co(function*() {
            try {

              const doc = msg.parsedContent()
              try {
                log("debug", msg, "try callback")
                yield callback(doc)

                if (successCallback) {
                  successCallback(doc, msg)
                    .then(res => log("debug", msg, "success callback", res))
                    .catch(err => log("error", msg, "error callback", err))
                }

              } catch(err) {
                log("error", msg, "try fail", err)
                
                if (msg.count() < max_try) {

                  /* smoth the retry process */
                  if (retry_timeout)
                    yield wait(retry_timeout)
                         .catch(err => log("error", msg, "fail retry timeout", err)
                  )
                  _broker.requeue(msg)
                        .then(() => log("debug", msg, "requeued"))
                        .catch(err => log("error", msg, "requeued error", err))

                } else {

                  if (failCallback)
                    failCallback(doc, err, msg)
                    .then(res => log("debug", msg, "failCallback success", res))
                    .catch(err => log("error", msg, "failCallback success", err))
                }

              } finally {
                emitter.emit("fail", msg)
              }
            } catch(err) {
              log("error", msg, "fail", err)
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
