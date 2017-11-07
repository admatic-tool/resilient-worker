const co = require("co")
const WorkerFactory = require("../index")
const logger = require("./support/logger")("[worker]")
const { failInTen } = require("./support/failer")

// factory
const chanceOfFail = 8

// connect factory to amqp server
const workerFactory = WorkerFactory('amqp://localhost', { logger })

// gen worker
const { worker, publish } = workerFactory.createWorker({

  // worker label name 
  name: "RandomWorker",

  // control queue
  queue: "job_example_queue",

  // (optional) if this info, the publisher use this
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test"
  },

  // max number of executing callback per message 
  max_try: 4,
  
  // (optional) smoth process of retry 
  retry_timeout: 1000,

  // callback need return a promise 
  callback: co.wrap(function*(doc) {
    failInTen(8)
  }),

  // (optional) need return a Promise
  // doc is a body message
  failCallback: co.wrap(function*(doc) {
    
    // this will be logged
    return [ "fail callback for", doc ]
  }),

  // (optional) need return a Promise
  // doc is a body message
  successCallback: co.wrap(function*(doc) {
    // this will be logged 
    return [ "sucess callback for", doc ]
  })
})

publish({ a: 1 })
publish({ a: 3 })
publish({ a: 4 })
publish({ a: 5 })

worker.start()
