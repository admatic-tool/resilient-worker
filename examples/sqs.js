"use strict"

const co = require("co")
const WorkerFactory = require("../index")
const logger = require("./support/logger")("[worker]")
const { failInTen } = require("./support/failer")


// connect factory to amqp server
const workerFactory = WorkerFactory("amqp://localhost")

// gen worker
const { worker, publish } = workerFactory.createWorker({

  // worker label name
  name: "RandomWorker",
  broker: "sqs",
  // control queue
  queue: "development-worker.fifo",

  // queue options to assert
  // queueOptions: {
  //   durable: true,
  //   messageTtl: 60*1000,
  //   maxLength: 50,
  //   deadLetterExchange: "job_example_deads"
  // },

  // (optional) if this info, the publisher use this
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test",
  },

  // max number of executing callback per message
  max_try: 4,

  // (optional) smoth process of retry
  retry_timeout: 1000,

  // callback need return a promise
  callback: co.wrap(function*(doc) {
    debugger
    failInTen(5)
  }),

  // (optional) need return a Promise
  // doc is a body message
  failCallback: co.wrap(function*(doc) {
    
    // this will be logged
    console.log(doc)
    return doc
  }),

  // (optional) need return a Promise
  // doc is a body message
  successCallback: co.wrap(function*(doc) {
    // this will be logged 
    return doc
  })
})


worker.start()


worker.on("log", (level, ...data) => {
  switch (level) {
    case "debug":
    logger.debug(...data)
    break

    case "error":
    logger.error(...data)
    break
  }
})

publish({ a: 1 })
publish({ a: 3 })
publish({ a: 4 })
publish({ a: 5 })
