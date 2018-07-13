"use strict"

const co = require("co")
const WorkerFactory = require("../../lib/index")
const logger = require("../support/logger")("[worker]")
const { failInTen } = require("../support/failer")


// gen worker
const { worker, publish } = WorkerFactory.createWorker({

  // worker label name
  name: "RandomWorker",
  
  // control queue
  broker: "sqs",
  aws: {
    region: "us-east-1"
  },
  queue: "development-worker.fifo",

  // max number of executing callback per message
  max_try: 4,

  // (optional) smoth process of retry
  retry_timeout: 1000,

  // callback need return a promise
  callback: messages =>{
    failInTen(5)
  }),

  // (optional) need return a Promise
  // doc is a body message
  failCallback: messages => {

    // this will be logged
    console.log(doc)
    return messages
  }),

  // (optional) need return a Promise
  // doc is a body message
  successCallback: messages => {
    // this will be logged
    return messages
  })
})


worker.start()



worker.on("log", (workerName, ...data) => {
  const [ level, messages , action ] = data

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
