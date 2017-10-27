const co = require("co")
const WorkerFactory = require("./index")


const BgReset = "\x1b[0m"

const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgYellow = "\x1b[33m"

// logger object
const loggerObj = {
  info(...args) {
    console.log(FgGreen, "[worker]", ...args, BgReset)
  },
  debug(...args) {
    console.log(FgGreen, "[worker]", ...args, BgReset)
  },
  error(...args) {
    console.error(FgRed, "[worker]", ...args, BgReset)
  }
}

// factory
const chanceOfFail = 8

// connect factory to amqp server
const workerFactory = WorkerFactory('amqp://localhost', { logger: loggerObj })

// gen worker 
const { worker, publish } = workerFactory.createWorker({

  // worker label name 
  name: "RandomWorker",

  // control queue
  queue: "job_example_queue",
  
  // max number of executing callback per message 
  max_try: 4,
  
  // (optional) smoth process of retry 
  retry_timeout: 1000,

  // callback need return a promise 
  callback: co.wrap(function*(doc) {
    const [ min, max ] = [ 1 , 10 ]
    const event = Math.random() * (max - min) + min
    console.log(event)
    if(event <= chanceOfFail)
      throw Error("random error")
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


co(function*() {
  publish({ a: 1 })
  publish({ a: 3 })
  publish({ a: 4 })
  publish({ a: 5 })
  

  worker.start()
})

