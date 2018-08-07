"use strict"

const WorkerFactory = require("../../lib/index")
const logger = require("../support/logger")("[worker]")
const { failInTen } = require("../support/failer")

// gen worker
const { worker, publish } = WorkerFactory.createWorker({

  // rabbit url
  connectUrl: "amqp://localhost",

  // worker label name
  name: "RandomWorker",
  // control queue

  queue: "job_example_queue",

  // queue options to assert
  // queueOptions: {
  //   durable: true,
  //   messageTtl: 60*1000,
  //   maxLength: 50,
  //   deadLetterExchange: "job_example_deads"
  // },
  // (optional)
  bulkSize: 10,
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test",
  },

  // max number of executing callback per message
  max_try: 2,

  // (optional) smooth process of retry
  retry_timeout: 5000,

  /**
   * @param { Message[] } messages
   */
  callback(messages) {

    return new Promise(resolve => {
      setTimeout(() => {
        messages.forEach((msg, i) => {
          try {
            const content = msg.getParsedContent()

            console.log("processing: ", i, content)

            failInTen(5)
            msg.setSuccess({ msg: content })
          } catch(err) {

            msg.setFail(err)

            if (i === 0)
              msg.doNotContinueTry()
          }
        })

        resolve(true)
      }, 1000)
    })
  },

  // (optional)
  failCallback(messages) {
    failInTen(2) //this can throw an error

    // this will be logged
    console.log("fails:", messages.map(msg => [ msg.getParsedContent(), msg.getError().message ]))
  },

  // (optional)
  // doc is a body message
  successCallback(messages) {
    failInTen(1) //this can throw an error

    console.log("success:", messages.map(msg => msg.getSuccessPayload()))
  },
})


// worker.start()
worker.start().then(() => worker.stop()).then(() => worker.start())

const logLevels = [ "debug", "info", "warn", "error" ]

worker.on("log", (workerName, ...data) => {
  const [ level, messages, action, additionalInfo ] = data

  if (logLevels.indexOf(level) >= 0) {
    const extra = additionalInfo ? (additionalInfo.toString ? additionalInfo.toString() : JSON.stringify(additionalInfo)) : undefined
    if (messages.length) {
      messages.forEach(msg => {
        const { message: errorMessage } = msg.getError() || {}
        logger[level]({ workerName, messageId: msg.messageId(), tryCount: msg.tryCount(), contents: msg.toString(), action, errorMessage, extra })
      })
    }
    else {
      logger[level]({ workerName, action, extra })
    }
  }
})

// publish({ a: 1 })
// publish({ a: 2 })
// publish({ a: 3 })
// publish({ a: 4 })
// publish({ a: 5 })

// publish({ a: 6 })
let n = 0
const batch = () => {
  setTimeout(() => {
    let count = 0
    while (count++ < 15)
      publish({ a: n++ })

    batch()

  }, 1000 * 3)
}

batch()
