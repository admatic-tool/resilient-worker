"use strict"

const co = require("co")
const WorkerFactory = require("../lib/index")
const logger = require("./support/logger")("[worker]")
const { failInTen } = require("./support/failer")

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
  prefetch: 5,
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test",
  },

  // max number of executing callback per message
  max_try: 4,

  // (optional) smoth process of retry
  retry_timeout: 5000,

  // callback need return a promise
  callback: co.wrap(function*(messages) {

    messages.forEach(msg => {
      try {
        failInTen(5)
      } catch(err) {
        messages.setFailed(msg, err)
      }
    })

    return true
  }),

  // (optional) need return a Promise
  failCallback: co.wrap(function*(messages) {
    // this will be logged
    console.log("fails:", messages.payloads())
    return messages
  }), 

  // (optional) need return a Promise
  // doc is a body message
  successCallback: co.wrap(function*(messages) {

    console.log("success:", messages.payloads())

    return messages
  })
})


worker.startBulk()
// worker.start()


worker.on("log", (workerName, ...data) => {
  const [ level, messages ] = data

  switch (level) {
    case "debug":
    messages.forEach(msg => {
      logger.debug(...[ workerName, msg.messageId(), msg.count() ])
    })
    break

    case "error":
    messages.forEach(msg => {
      logger.error(...[ workerName, msg.messageId(), msg.count() ])
    })
    break
  }
})


setInterval(() => {

  publish({ a: 1 })
  publish({ a: 2 })
  publish({ a: 3 })
  publish({ a: 4 })
  publish({ a: 5 })

  publish({ a: 6 })
  publish({ a: 7 })
  publish({ a: 8 })
  publish({ a: 9 })
  publish({ a: 10 })

}, 1000 * 1)
