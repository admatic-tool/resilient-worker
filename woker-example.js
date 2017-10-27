const co = require("co")
const WorkerFactory = require("./index")
// factory
const chanceOfFail = 8

// connect factory to amqp server
const workerFactory = WorkerFactory('amqp://localhost')

// gen worker 
const { worker, publish } = workerFactory.createWorker({
  
  // control queue
  queue: "job_example_queue",
  
  // max number of executing callback per message 
  max_try: 4,
  
  // smoth process of retry 
  retry_timeout: 1000,

  // callback need return a promise 
  callback: co.wrap(function*(doc) {
    const [ min, max ] = [ 1 , 10 ]
    const event = Math.random() * (max - min) + min
    console.log(event)
    if(event <= chanceOfFail)
      throw Error("random error")
  })
})


co(function*() {
  publish({ a : 1 })
  worker.start()
})

