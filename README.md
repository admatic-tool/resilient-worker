Resilient Worker
===
Is a worker library designed to works with different queue brokers (actualy **RabbitMQ** and  **AWS SQS**), offerting a common interface to **retry policy**, **successCallbacks**, **failCallbacks** , **ignore messages** and **bulk processing**.


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
   * queueOptions: If is setted are useds to assert queue, create queue if it not exists
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
**Resilient-Consumer** is agnostic of logger method, but it emits events
that can be tracked by `worker.on(eventName, callback(...params))` method


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

In some cases the message payload have problems (missing fields and others when not works more retries).
For these cases use `msg.doNotContinueTry()` to mark message to not continue retry.


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
Some workers need to be idempotent and do not proccess same type of message twice,
use `msg.setIgnore()` to mark message to be ignored and it not will pass by `worker.successCallback()` or `worker.failCallback()` and not will be retried too.

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
The sqs worker will load your credendials by your **aws credential file** or by envvars:
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
  - suport publish in **AWS SNS Topic** to aws `publish()` , using `publishIn` attribute