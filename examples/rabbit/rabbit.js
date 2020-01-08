const WorkerFactory = require('../../lib/index')
const logger = require('../support/logger')('[worker]')
const { failInTen } = require('../support/failer')
// gen worker
const { worker, publish } = WorkerFactory.createWorker({
  // rabbit url
  connectUrl: 'amqp://localhost',

  // worker label name
  name: 'RandomWorker',
  // control queue
  queue: 'job_example_queue',
  bulkSize: 1,

  // queue options to assert
  // queueOptions: {
  //   durable: true,
  //   messageTtl: 60*1000,
  //   maxLength: 50,
  //   deadLetterExchange: "job_example_deads"
  // },

  // (optional) if this info, the publisher use this
  publishIn: {
    routingKey: 'jobs_key',
    exchange: 'test'
  },

  // max number of executing callback per message
  max_try: 4,

  // (optional) smooth process of retry
  retry_timeout: 1000,

  // callback need return a promise
  callback(messages) {
    failInTen(5)
    return messages
  },

  // (optional)
  // messages object
  failCallback(messages) {
    // this will be logged
    console.log(messages)
  },

  // (optional)
  // messages object
  successCallback(messages) {
    // this will be logged
    console.log(messages)
  }
})

worker.start()

const logLevels = ['debug', 'info', 'warn', 'error']

worker.on('log', (workerName, ...data) => {
  const [level, messages, action, additionalInfo] = data

  if (logLevels.indexOf(level) >= 0) {
    const extra =
      additionalInfo && additionalInfo.toString
        ? additionalInfo.toString()
        : JSON.stringify(additionalInfo || undefined)
    if (messages.length) {
      messages.forEach(msg => {
        const { message: errorMessage } = msg.getError() || {}
        logger[level]({
          workerName,
          messageId: msg.messageId(),
          tryCount: msg.tryCount(),
          contents: msg.toString(),
          action,
          errorMessage,
          extra
        })
      })
    } else {
      logger[level]({ workerName, action, extra })
    }
  }
})

publish({ a: 1 })
publish({ a: 3 })
publish({ a: 4 })
publish({ a: 5 })
