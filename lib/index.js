
"use strict"

const uuidv4 = require("uuid/v4")
const { EventEmitter } = require("events")
const co = require("co")

const brokers = {
  rabbit: "./brokers/rabbit/",
  sqs: "./brokers/sqs/",
}

const WorkerFactory = {

  _configure(opts) {
    const {
      broker = "rabbit",
      exitOnCancel = true,
      retry_timeout = 0,
      bulkSize = 1,
      prefetch = bulkSize || 1,
    } = opts

    return Object.assign({ broker,
                           exitOnCancel,
                           retry_timeout,
                           bulkSize,
                           prefetch: prefetch >= bulkSize ? prefetch : bulkSize,
    }, opts)
  },

  createWorker(opts) {

    const config = this._configure(opts)

    const {
      broker,
      exitOnCancel,
      callback,
      name,
      successCallback,
      failCallback,
      max_try,
      retry_timeout,
      bulkSize,
    } = config


    const BrokerClass = require(brokers[broker])
    const emitter =  new EventEmitter()
    const _broker = new BrokerClass(config)

    const worker = {
      _status: "STOPPED",

      on(event, callback) {
        emitter.on(event, callback)
      },

      log(level, msg, message, ...resources) {
        emitter.emit(...[ "log", name, level, msg, message, ...resources ])
      },

      stop() {
        this._status = "STOPPING"
        this.log("debug", [], "worker:shutdown")
        return _broker.stop()
          .then(() => {
            this._status = "STOPPED"
            const logListeners = emitter.listeners("log")

            emitter.removeAllListeners()
            logListeners.map(listener => emitter.on("log", listener))
          })
      },

      start() {
        if (this._status === "STOPPED")
          this._status = "STARTING"
        else
          throw new Error("worker is not on STOPPED state")

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

        limitTimeCountDown = startLimitTimeCountDown()

        emitter.on("worker:cancel", (exit = false) => {
          log("debug", [], "worker:cancel")

          this.stop()
            .then(() => {
              if (exit) {
                log("error", [], "worker:exit")
                process.exit(-1)
              }
            })
        })

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
            log("debug", [ ], "cancelled")
            emitter.emit("worker:cancel", exitOnCancel)
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

          log("debug", successMessages, "before successCallback")
          log("debug", tryFailMessages, "before tryFailCallback")

          emitter.emit("bulk:try:success", successMessages)
          emitter.emit("bulk:try:fail", tryFailMessages)
          emitter.emit("bulk:try:end", messages)
        })

        emitter.on("bulk:try:success", messages => {

          if (successCallback && messages.length > 0)

            try {
              const execution = successCallback(messages)

              if (execution && execution.then)
                execution.then(res => log("info", messages, "successCallback", res))
                          .catch(err => log("error", messages, "successCallback", err))
              else
                log("info", messages, "successCallback", execution)


            } catch(err) {
              log("error", messages, "successCallback", err)
            }
        })

        emitter.on("bulk:try:fail", messages => {
          if (messages.length === 0)
            return

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
                execution.then(res => log("info", messages, "failCallback", res))
                          .catch(err => log("error", messages, "failCallback", err))

              else
                log("info", messages, "failCallback", execution)

            } catch(err) {
              log("error", messages, "failCallback", err)
            }

        })

        emitter.on("bulk:try:retry", messages => {
          if (messages.length === 0)
            return

          setTimeout(() => {
            messages.map(msg => _broker.requeue(msg))
            log("debug", messages, "requeued")
          }, retry_timeout)
        })

        emitter.on("bulk:try:end", messages =>
          messages.forEach(msg => {
            setImmediate((msg, log) => {
              log("debug", [ msg ], "remove")
              try {
                _broker.remove(msg)
              }
              catch(err) {
                log("error", [ msg ], "remove", err)
              }
            }, msg, log)
          })
        )

        return _broker.consume(msg =>
          emitter.emit("msg:received", msg)
        )
        .then(() => {
          this._status = "STARTED"
          log("debug", [], "broker started")
        })
        .catch(err => {
          log("error", [], "broker started", err)
          emitter.emit("worker:cancel", true)
        })

      },
    }

    return {
      worker,
      publish: doc => _broker.publish(doc, uuidv4(), 1),
    }
  },
}

module.exports = WorkerFactory
