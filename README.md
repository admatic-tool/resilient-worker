Resilient Worker
===

proof of concept to a resilient worker using ampq client

# features
 - use a rabbitmq to control the flux
 - return `worker` and an `publish` hedged in a same queue
 - control retries
 - callback on fail
 - callback on success
 - timeout a executin when fail to smoth retries

# install
```shell
$ npm install resilient-consumer --save
```

# Usage
```javascript
const co = require("co")
const WorkerFactory = require("resilient-consumer")

// factory
const chanceOfFail = 8

// connect factory to amqp server
// const workerFactory = WorkerFactory('amqp://localhost')

// gen worker 
const { worker, publish } = WorkerFactory.createWorker({
  
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
  }),

  // need return a Promise
  // doc is a body message
  failCallback: co.wrap(function*(doc) {
    console.error("fail callback for", doc)
  }),

  // need return a Promise
  // doc is a body message
  successCallback: co.wrap(function*(doc) {
    console.error("sucess callback for", doc)
  })
})


co(function*() {
  publish({ a: 1 })
  publish({ a: 3 })
  publish({ a: 4 })
  publish({ a: 5 })
  

  worker.start()
})
```

# Helpers
### executeNext(arguments, middlewareActions, stepN = 1)
```javascript
// supose that we have a chain of actions to be performed, like a middleware
const middlewareActions = [
  { 
    order: 1, 
    call: name => Promise.resolve([ name, "hello" ]) 
  },
  { 
    order: 2, 
    call: ([ name, message ]) =>
      Promise.resolve([ name, message ].join(", ")) 
  },
]

executeNext("luiz", middlewareActions ).then(res =>
  console.log(res)
)
// "luiz, hello"
```
but if this fail
```javascript
// supose that we have a chain of actions to be performed, like a middleware
const middlewareActions = [
  { 
    order: 1, 
    call: names => Promise.resolve([ names, "hello" ]) 
  },
  { 
    order: 2, 
    call: ([ names, message ]) =>
      Promise.resolve([ names.join(), message ].join(", ")) 
  },
]

// the argument is a string, wich no have .join() method
executeNext("luiz", middlewareActions ).then(res =>
  console.log(res)
).catch(err => {
  /* error has a aditional metadata,about a 
    - step that error occurs
    - the arguments that step worker

    with this, it can be restarted
  */
  console.error(err.step, err.arguments)
  const [ name, message ] = err.arguments
  executeNext([[name], message], middlewareActions, err.step).then(res => {
    console.log(res)
   // "luiz, hello"
  })
})
```

# TODO
 - ampq configs (prefetch, ...)
 - options, assertion of queue