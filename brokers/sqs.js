"use strict"

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

  publish(message, executionId, try_count) {

    const params = {
      MessageBody: JSON.stringify(message), /* required */
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


    return sqs.sendMessage(params)
              .promise()
  }

  _removeFromQueue(message) {
    return sqs.deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.properties.ReceiptHandle
    }).promise()
  }

  requeue(message, executionId, try_count) {
    return this.publish(message, executionId, try_count)
  }

  *consume(callback) {
    const { emitter } = this

    emitter.on("fail", msg => {
      this._removeFromQueue(msg)
    })

    const params = {
      QueueUrl: this.queueUrl,
      AttributeNames: [ "All" ],
      MessageAttributeNames: [ "executionId", "try_count" ],
    }

    while (true) {
      yield sqs.receiveMessage(params)
         .promise()
         .then(data => {

          if (data.Messages) {
            const messages = data.Messages.map(msg => {

              return {
                properties: {
                  ReceiptHandle: msg.ReceiptHandle,
                  messageId:  msg.MessageAttributes.executionId.StringValue,
                  headers: {
                    try_count: parseInt(msg.MessageAttributes.try_count && msg.MessageAttributes.try_count.StringValue || 0),
                  }
                },
                content: msg.Body,
               }
             })


             messages.map(msg => callback(msg))
           }
         })
         .catch(err => console.error(err))
    }
  }
}
