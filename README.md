Resilient Worker
===
[![CircleCI](https://circleci.com/gh/b2wads/resilient-worker/tree/master.svg?style=svg)](https://circleci.com/gh/admatic-tool/resilient-worker/tree/master)

A worker lib designed to pull-and-process messages from different queue brokers (actually supporting **RabbitMQ** and  **AWS SQS**), which offers a common interface to **retry policy**, **successCallbacks**, **failCallbacks** , **ignore messages** and **bulk processing**.


# Table of Contents
 - [Install](#install)
 - [Usage](#usage)
   * [Example](#example)
   * [Log](#log)
   * [Do not Retry](#do-not-retry)
   * [Idempotency](#idempotency)
   * [SQL](#sqs)
 - [Roadmap](#roadmap)


# Install
```bash
$ npm install resilient-consumer --save
```

# Usage

## Example
```javascript
const WorkerFactory = require("resilient-consumer")


/**
 * gen worker/publish pair
*/ 

const { worker, publish } = WorkerFactory.createWorker({

  /**
   * identity of worker
  */
  name: "RandomWorker",

  /**
   * (default: rabbit)
  */
  broker: "rabbit",

  /**
   * (Only for rabbitMq)
   */
  connectUrl: "amqp://localhost",

  /**
   * The target Queue that worker will consume
   */
  queue: "job_example_queue",

  /**
   * (default: bulkSize)
   * How many messages will be received at once from the broker
   */
  prefetch: 10,
  
  /** 
    * (default: 1)
    * Is a size of bulk messages that need be filled before worker begin to proccess messages
    * (obs: If bulk not be filled in 10 seconds, it will be flushed too)
  */
  bulkSize: 10,

  /**
  * (optional)
  * (Only for rabbitMq)
  */ 
  publishIn: {
    routingKey: "jobs_key",
    exchange: "test",
  },

  /**
   * max_try: max number of executing callback per message
   */
  max_try: 4,
  
  /** 
   * (optional) 
   * If setted the retry proccess will smooth by waiting this value in milisseconds before resend message to queue
  */
  retry_timeout: 1000,

  /**
   * (optional)
   * (Only for rabbitMq)
   * queueOptions: Used to assert queue, create queue if it doesn't exist
   * or confirm these properties in target queue before start()
  */
  queueOptions: {
    durable: true,
    messageTtl: 60*1000,
    maxLength: 50,
    deadLetterExchange: "job_example_deads"
  },

  /**
   * callback(messages):
   * In this method the messages will be processed by your business logic
   * and marked with some flags wich updates it internal state
   */
  callback(mesages) {
    const [ min, max ] = [ 1 , 10 ]
    const chanceOfFail = 8

    for(const msg of messages) {
      try {
        const event = Math.random() * (max - min) + min

        if(event <= chanceOfFail)
          throw Error("random error")

        // get message content already parsed in object
        const { value } = msg.getParserdContent()

        // mark message as success end deliver to it a payload
        msg.setSuccess({ newValue: event + value })

      } catch(err) {
        // mark message as failed and deliver to it a error
        msg.setFailed(err)
      }
    }
  },


  /**
   * failCallback(messages):
   * (optional) 
   * If setted is called to messages that fails (markeds by msg#setFailed()) in a bulk and can not be retryed
   */
  failCallback(messages)  {
    console.error("fail callback for", messages)
  }),

  /**
   * successCallback(messages):
   * (optional) 
   * If setted is called to messages that success in a bulk (or without errors)
   */
  successCallback(messages) {
    console.log("sucess callback for", messages)
  })
})

/**
 * use publishIn(if setted) or queue to send a message to your destin
*/
publish({ value: 1 })
publish({ value: 3 })
publish({ value: 4 })
publish({ value: 5 })

/**
 * start worker to consume target queue
 */
worker.start()
```


## Log
**Resilient-Consumer** is agnostic in terms of logging strategy, but it does emit trackable log events, implemented by the pattern `worker.on(eventName, callback(...params))`


```javascript
worker.start()

/**
 * tack all "log" events, and works on these events
 */
worker.on("log", (workerName, ...data) => {
  const [ level, messages, action ] = data

  switch (level) {
    case "debug":
      messages.forEach(msg => {
        logger.debug(...[ workerName, msg.messageId(), msg.tryCount(), msg.getParsedContent(), action ])
      })
      break

    case "error":
      messages.forEach(msg => {
        logger.error(...[ workerName, msg.messageId(), msg.tryCount(), msg.getParsedContent(), action ])
      })
      break
  }
})
```

## Do Not Retry

The message payload may have errors sometimes (such as missing fields or other problems which doesn't worth a retry). For those cases you can use `msg.doNotContinueTry()` and mark the message to prevent the worker from retrying to process it.


```javascript
callback(messages) {
  for(const msg of messages) {
    const values = msg.getParsedContent()
      apiClient.add(values)
                .then(res => msg.setSuccess({ msg: "ok" }))
                .catch(err => {
                  msg.setFail(err)
                  // statusCode 4xx represents in http api a problem with client
                  if(err.statusCode => 400 && err.statusCode > 500) {
                    // this message not will be retryed
                    msg.doNotContinueTry()
                  }
                })
  }
}
```

## Idempotency
You may need a worker with idempotent behavior for some types of messages, which means that it won't retry to process them twice. Mark those messages with `msg.setIgnore()` and they will also bypass `worker.successCallback()` and `worker.failCallback()` methods.

```javascript
callback(messages) {

  for(const msg of messages) {
    try {
      if(alreadyProcessed(msg.getMessageId())) {
        // mark message to be ignored
        msg.setIgnore()
      } else {
        /** works on message **/
      }
    }
  }
}
```

## SQS 
**Experimental**

The SQS worker will load your credendials from an **aws credential file** or from envvars:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY


```javascript

const { worker, publish } = WorkerFactory.createWorker({

  
  name: "SqsWorker",

  /**
   * set "sqs" value to broker attribute
  */
  broker: "sqs",

  /**
   * set region in aws
  */
  aws: {
    region: "us-east-1",
  },
  /**
   * specify a queue name in AWS sqs
   * (obs: today this will be a queue where a publish() will deliver message )
  */
  queue: "development-worker.fifo",

  bulkSize: 10,
  max_try: 4,
  callback(mesages) {
    // business logic ...
  },
})
```

# Roadmap
  - [sqs broker] Support for publishing in a **AWS SNS Topic**, using the worker's `publishIn` attribute.
  - Add own logger
  - Add publisher retries
  - Use backoff factor for retries
  - Drop ES5 support