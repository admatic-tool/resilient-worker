const AWS = require('aws-sdk')
const co = require("co")


const sqs = new AWS.SQS({ apiVersion: '2012-11-05', region: 'us-east-1' })

module.exports = class SqsBroker {

  constructor(connectUrl, emitter,  opts = {}) {
    this.opts = opts
    this.connectUrl = connectUrl
    this.emitter = emitter

    this.queueUrl = "https://sqs.us-east-1.amazonaws.com/775433464097/development-worker.fifo"


    this.publish = co.wrap(this.publish.bind(this))
    this.requeue = co.wrap(this.requeue.bind(this))

    this.consume = co.wrap(this.consume.bind(this))
  }



  *publish(message) {
  //   const QueueUrl = yield this.getQueueUrl()

  //   debugger
    const params = {
      MessageBody: JSON.stringify(message), /* required */
      QueueUrl: this.queueUrl,
      DelaySeconds: 0,
      MessageAttributes: {
      },
      MessageGroupId: "1",
      MessageDeduplicationId: "1"
    }

    sqs.sendMessage(params).promise().then(data => {
      console.log(data)
    }).catch(err => {
      console.error(err)
    })
  }

  *requeue(message, executionId, try_count) {

  }

  *consume(callback) {
    const { emitter } = this
    emitter.on("fail", msg => {
      console.log(msg)
    })

    const params = {
      QueueUrl: this.queueUrl
    }

    while(true) {
      yield sqs.receiveMessage(params)
         .promise()
         .then(data => {
           if (data.Messages) {

/*          const { properties } = msg
            const {
              messageId = uuidv4(),
              headers
            } = properties

            const { try_count = 1 } = headers
            */
             const messages = data.Messages.map(msg => 
              ({
                properties: {
                  messageId: "xxx",
                  headers: {},
                },
                content: msg.Body
              })
             )

             messages.map(msg => callback(msg))
           }
         })
         .catch(err => console.error(err))
    } 
  }
}
