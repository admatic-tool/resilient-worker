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
  bulkSize: 10,

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
  callback(messages) {

    failInTen(5)

  },

  // (optional)
  // messages object
  failCallback(messages) {

    // this will be logged
    // console.log(messages)
  },

  // (optional)
  // messages object
  successCallback(messages) {
    // this will be logged
    // console.log(messages)
  }
})


worker.start()


worker.on("log", (workerName, ...data) => {
  const [ level, messages, action ] = data

  switch (level) {
    case "debug":
    messages.forEach(msg => {
      logger.debug(...[ workerName, msg.messageId(), msg.count(), action ])
    })
    break

    case "error":
    messages.forEach(msg => {
      logger.error(...[ workerName, msg.messageId(), msg.count(), action ])
    })
    break
  }
})

publish({ a: 1 })
publish({ a: 3 })
publish({ a: 4 })
publish({ a: 5 })
