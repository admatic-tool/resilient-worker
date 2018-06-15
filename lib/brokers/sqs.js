"use strict"

const AWS = require("aws-sdk")
const co = require("co")
const Message = require("../message")


module.exports = class SqsBroker {

  constructor(opts = {}, emitter) {
    this.opts = opts
    this.emitter = emitter
    this.sqs = new AWS.SQS({ apiVersion: '2012-11-05', region: opts.aws.region })

    this.publish = co.wrap(this.publish.bind(this))
    this.requeue = co.wrap(this.requeue.bind(this))
    this.consume = co.wrap(this.consume.bind(this))
  }


  publish(message, executionId, try_count) {
    this._getQueueUrl().then(() => {

      const params = {
        MessageBody: JSON.stringify(message),
        QueueUrl: this.queueUrl,
        DelaySeconds: 0,
        MessageAttributes: {
          executionId: {
            DataType: "String",
            StringValue: executionId,
          },
          try_count: {
            DataType: "String",
            StringValue:  try_count.toString(),
          }
        },
        MessageGroupId: [ executionId, try_count ].join(":"),
        MessageDeduplicationId: [ executionId, try_count ].join(":"),
      }


      return this.sqs.sendMessage(params)
                .promise()
    })
  }

  _getQueueUrl() {

    if (this.queueUrl) {
      return Promise.resolve(this.queueUrl)
    } else {
      const { opts } = this
      return this.sqs.getQueueUrl({ QueueName: opts.queue })
              .promise()
              .then(res => res.QueueUrl)
    }
  }


  _removeFromQueue(message) {
    return this.sqs.deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.getOriginal().ReceiptHandle
    }).promise()
  }

  requeue(message, executionId, try_count) {
    this._getQueueUrl().then(() => this.publish(message, executionId, try_count))
  }

  *consume(callback) {
    const { emitter } = this

    emitter.on("fail", msg => {
      this._removeFromQueue(msg)
    })

    this.queueUrl =  yield this._getQueueUrl()

    const params = {
      QueueUrl: this.queueUrl,
      AttributeNames: [ "All" ],
      MessageAttributeNames: [ "executionId", "try_count" ],
    }


    while (true) {
      yield this.sqs.receiveMessage(params)
         .promise()
         .then(data => {

          if (data.Messages) {
            const messages = data.Messages.map(msg => {
              return new Message({
                messageId: msg.MessageAttributes.executionId.StringValue,
                count: parseInt(msg.MessageAttributes.try_count.StringValue),
                content: msg.Body,
              }, msg)
             })

             messages.map(msg => callback(msg))
           }
         })
         .catch(err => console.error(err))
    }
  }
}
