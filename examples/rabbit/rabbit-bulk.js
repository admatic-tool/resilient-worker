"use strict"

const co = require("co")
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
  prefetch: 2,
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test",
  },

  // max number of executing callback per message
  max_try: 4,

  // (optional) smoth process of retry
  retry_timeout: 5000,

  // callback need return a promise
  callback: messages => {


    return new Promise(resolve => {
     
      setTimeout(() => {
        messages.forEach(msg => {
          try {
            // failInTen(5)
          } catch(err) {
            messages.setFailed(msg, err)
          }
        })

        resolve(true)
      }, 1000)
    })
  },

  // (optional)
  failCallback: messages => {
    // this will be logged
    console.log("fails:", messages.payloads())
    return messages
  }),

  // (optional)
  // doc is a body message
  successCallback: messages => {

    console.log("success:", messages.payloads())

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




// publish({ a: 1 })
// publish({ a: 2 })
// publish({ a: 3 })
// publish({ a: 4 })
// publish({ a: 5 })

// publish({ a: 6 })

setTimeout(() => {
  let n = 0
  while(n++ < 10) {
    publish({ a: n })
  }

}, 100 * 1)
