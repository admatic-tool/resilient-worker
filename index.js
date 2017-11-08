const co = require("co")
const amqplib = require("amqplib")
const uuidv4 = require('uuid/v4')
const { EventEmitter } = require('events')
const emitter = new EventEmitter()

// factory
const chanceOfFail = 8

const wait = milisseconds =>
  new Promise(resolve => setTimeout(resolve, milisseconds))

const WorkerFactory = (connectUrl, opts = {}) => {

  const _conn = amqplib.connect(connectUrl)

  // return workerFactory
  return {

    createWorker: meta => {

      const { 
        name, 
        max_try = 1, retry_timeout,
        callback, failCallback, successCallback,
        queue, publishIn = {}
      } = meta

      const { exchange, routingKey } = publishIn
      
      const requeue = co.wrap(function*(message, executionId) {
        const conn = yield _conn
        const ch = yield conn.createChannel()

        try {

          const ok = yield ch.assertQueue(queue)
          
          if (ok) {
            ch.sendToQueue(
              queue, 
              new Buffer(JSON.stringify(message)),
              { messageId: executionId }
            )
            emitter.emit("log", "debug", name, executionId, "publishing", message)
          }

          ch.close()
          
          return true

        } catch (err) {

          ch.close()
          throw err
        }
      })

      const publish = co.wrap(function*(message) {
        const conn = yield _conn
        const ch = yield conn.createChannel()

        try {

          if (exchange && routingKey)
            ch.publish(exchange, routingKey , new Buffer(JSON.stringify(message)))
          else if(queue)
            ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))
          else 
            throw new Error("no exchange & routingKey specified or a simple queue")
          
          emitter.emit("log", "debug", name, "publishing", message)
            
          ch.close()
          
          return true

        } catch (err) {

          ch.close()
          throw err
        }
      })

      const worker = {

        start: co.wrap(function*() {
          
          const self = this
          const conn = yield _conn
          
          const ch = yield conn.createChannel()

          const ok = yield ch.assertQueue(queue)
          
          if(ok) {
            
            ch.consume(queue, msg => {

              if (msg === null) {
                emitter.emit("log", "debug", name, "cancelled")
                return
              }
          

              const { properties } = msg
              const messageId = properties.messageId || uuidv4()

              co(function*() {

                try {
                  
                  const message = JSON.parse(msg.content.toString())
                  
                  try {
                    emitter.emit("log", "debug", name, messageId, "try callback")
                    
                    yield callback(message)
                    
                    if (successCallback) {

                      successCallback(message)
                        .then(res =>
                          emitter.emit("log", "debug", name, messageId, "success callback", res)
                        )
                        .catch(err => 
                          emitter.emit("log", "debug", name, messageId, "error callback", err)
                        )
                    }

                  } catch (err) {
                    emitter.emit("log", "error", name, messageId, "try fail", err)
                    
                    if (message.retry)
                      ++message.retry
                    else
                      message.retry = 1

                    if (message.retry < max_try) {

                      /* smoth the retry process */ 
                      if(retry_timeout)
                        yield wait(retry_timeout).catch(err => 
                          emitter.emit(
                            "log", "error", name, messageId, "fail retry timeout", err
                          )
                        )
                        
                      requeue(message, messageId)

                    } else {

                      if (failCallback)
                        failCallback(message)
                        .then(res => 
                          emitter.emit("log", "debug", name, messageId, "fail callback", res)
                        )
                        .catch(err =>
                          emitter.emit("log", "error", name, messageId, "fail callback", err)
                        )
                    }

                  } finally {
                    ch.ack(msg)
                  }
                } catch (err) {
                  emitter.emit("log", "error", name, messageId, err)
                  ch.ack(msg)
                }
              })
            })
          } else {
            emitter.emit("log", "error", "no queue:", queue)
          }
        }) // end start
      }

      
      return { worker , publish, emitter }
    }
  }
}

module.exports = WorkerFactory