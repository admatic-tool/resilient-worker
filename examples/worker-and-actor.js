const co = require("co")

const logger = require("./support/logger")("[worker]")

const WorkerFactory = require("../index")
const { executeNext } = require("../helpers")
const { failInTime } = require("./support/failer")

const failer = failInTime(2)

const sceneChain = [
  // actors
  { 
    order: 1, 
    call: (args) => {
      logger.debug("first actor (order 1)")
      return new Promise(resolve => {
        failer.fail()
        
        setTimeout(() => 
          resolve(args), 
        500)
      })
    }
  },
  { 
    order: 2, 
    call: prevRes => {
      logger.debug("second actor (order 2)")
      failer.fail()
      
      return new Promise(resolve => {
        setTimeout(() => {
          logger.debug("done")
          resolve(prevRes)
        } , 
        1000)
      })
    }
  }
]



// connect factory to amqp server
const workerFactory = WorkerFactory('amqp://localhost', { logger })

// gen worker
const { worker, publish } = workerFactory.createWorker({

  // worker label name 
  name: "RandomWorker",

  // control queue
  queue: "job_example_queue",
  
  // max number of executing callback per message 
  max_try: 2,
  
  // (optional) smoth process of retry 
  retry_timeout: 1000,

  // callback need return a promise 
  callback: co.wrap(function*(doc) {
    
    const step = doc.step || 1

    try {
      return yield executeNext(doc, sceneChain, step)
    } catch (err) {
      // erro is enchanced with keys step, argments, and 
      logger.error(`error in step`, err.step)
      
      doc.step = err.step

      throw err
    }
  }),
})


publish({ a: 1 })

worker.start()