
"use strict"

const uuidv4 = require("uuid/v4")
const { EventEmitter } = require("events")

const brokers = {
  rabbit: "./brokers/rabbit/",
  sqs: "./brokers/sqs/",
}

const WorkerFactory = {

  createWorker(config) {

    const { broker = "rabbit" } = config

    const BrokerClass = require(brokers[broker])
    const emitter =  new EventEmitter()
    const _broker = new BrokerClass(config)

    const {
      callback,
      name,
      successCallback,
      failCallback,
      max_try,
      retry_timeout = 0,
      bulkSize = 1,
    } = config

    const worker = {

      on(event, callback) {
        emitter.on(event, callback)
      },

      log(level, msg, message, ...resources) {
        emitter.emit(...[ "log", name, level, msg, message, ...resources ])
      },


      start() {
        const { log } = this

        const messageAccumulator = []
        let limitTimeCountDown

        function startLimitTimeCountDown() {

          if (limitTimeCountDown)
            clearInterval(limitTimeCountDown)

          return setTimeout(() => {
            if (messageAccumulator.length > 0) {
              log("debug", messageAccumulator, "bulk:flush (timeout)")
              emitter.emit("bulk:flush", messageAccumulator.splice(0, bulkSize))
            }

          }, 10 * 1000)
        }


        startLimitTimeCountDown()

        emitter.on("msg:received:checked", msg => {
          log("debug", [ msg ], "msg:received:checked")

          messageAccumulator.push(msg)
          if (messageAccumulator.length >= bulkSize) {
            log("debug", messageAccumulator, "bulk:flush (bulkSize)")
            emitter.emit("bulk:flush", messageAccumulator.splice(0, bulkSize))
          }

        })

        // TODO - validate message on receive
        emitter.on("msg:received", msg => {
          if (msg === null) {
            log("debug", {}, "cancelled")
            return
          }

          emitter.emit("msg:received:checked", msg)
        })

        emitter.on("bulk:flush", messages => {
          startLimitTimeCountDown()

          try {
            /**
             * can return positive, falsy or an array of messages inside a Promise or not
            */
            const execution = callback(messages)

            if (execution && execution.then) { // Returned a promise
              execution
                .then(successMessages => {
                  if (successMessages && successMessages.map)
                    emitter.emit("bulk:processed", successMessages)
                  else
                    emitter.emit("bulk:processed", messages)
                }).catch(err => {
                  emitter.emit("bulk:processed", messages.map(message => message.setFail(err)))
                })
            }
            else {
              if (execution && execution.map)  // Returned messages
                emitter.emit("bulk:processed", execution)
              else
                emitter.emit("bulk:processed", messages) // Returned other value
            }

          } catch(err) {
            emitter.emit("bulk:processed", messages.map(message => message.setFail(err)))
          }
        })

        emitter.on("bulk:processed", messages => {
          const tryFailMessages = []
          const successMessages = []

          for (const message of messages.filter(msg => !msg.isIgnored())) {
            if (message.isSuccess()) {
              successMessages.push(message)
            } else {
              tryFailMessages.push(message)
            }
          }

          log("debug", successMessages, "callback")
          log("error", tryFailMessages, "callback")


          emitter.emit("bulk:try:success", successMessages)
          emitter.emit("bulk:try:fail", tryFailMessages)
          emitter.emit("bulk:try:end", messages)
        })

        emitter.on("bulk:try:success", messages => {

          if (successCallback && messages.length > 0)

            try {
              const execution = successCallback(messages)

              if (execution && execution.then)
                execution.then(res => log("debug", messages, "successCallback", res))
                         .catch(err => log("error", messages, "successCallback", err))
              else
                log("debug", messages, "successCallback", execution)


            } catch(err) {
              log("error", messages, "error callback", err)
            }
        })

        emitter.on("bulk:try:fail", messages => {
          const messagesToRetry = messages.filter(msg => msg.tryCount() < max_try && msg.isContinueOnError())

          emitter.emit("bulk:try:retry", messagesToRetry)

          const messagesToCancel =  messages.filter(msg => msg.tryCount() >= max_try || !msg.isContinueOnError())

          emitter.emit("bulk:try:cancel", messagesToCancel)
        })

        emitter.on("bulk:try:cancel", messages => {

          if (failCallback && messages.length > 0)
            try {
              const execution = failCallback(messages)

              if (execution && execution.then)
                execution.then(res => log("debug", messages, "failCallback", res))
                         .catch(err => log("error", messages, "failCallback", err))

              else
                log("debug", messages, "failCallback", execution)

            } catch(err) {
              console.log(err)
              log("error", messages, "failCallback", err)
            }

        })

        emitter.on("bulk:try:retry", messages => {
          setTimeout(() => {
            messages.map(msg => _broker.requeue(msg))
            log("debug", messages, "requeued")
          }, retry_timeout)
        })

        emitter.on("bulk:try:end", messages =>
          messages.forEach(msg => {
            setImmediate((msg, log) => {
              log("debug", [ msg ], "remove")
              return _broker.remove(msg)
            }, msg, log)
          })
        )

        _broker.consume(msg =>
          emitter.emit("msg:received", msg)
        )
      },
    }

    return {
      worker,
      publish: doc => _broker.publish(doc, uuidv4(), 1),
    }
  },
}

module.exports = WorkerFactory
