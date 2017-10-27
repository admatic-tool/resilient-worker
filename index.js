const co = require("co")
const amqplib = require("amqplib")

// factory
const chanceOfFail = 8

const wait = milisseconds =>
  new Promise(resolve => setTimeout(resolve, milisseconds))

const WorkerFactory = (connectUrl) => {

  const _conn = amqplib.connect(connectUrl)

  // return workerFactory
  return {

    createWorker: meta => {

      const { 
        queue, max_try, retry_timeout, callback, 
        failCallback, successCallback
      } = meta

      const publish = co.wrap(function*(message) {
        try {
        const conn = yield _conn
        const ch = yield conn.createChannel()
        const ok = yield ch.assertQueue(queue)
        
        if(ok)
          ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))
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

              co(function*() {

                try {

                  const message = JSON.parse(msg.content.toString())

                  try {
                    yield callback(message)

                    if (successCallback)
                      successCallback(message)

                  } catch (err) {

                    if (message.retry)
                      ++message.retry
                    else
                      message.retry = 1

                    if (message.retry < max_try) {
                      
                      /* smoth the retry process */ 
                      if(retry_timeout)
                        yield wait(retry_timeout)

                      yield publish(message)
                    } else {
                      if (failCallback)
                        failCallback(message)
                    }

                  } finally {
                    ch.ack(msg)
                  }
                } catch (err) {
                  console.error(err)
                  ch.ack(msg)
                }
              })
            })
          } // end ok
        }) // end start
      }

      return { worker , publish }
    }
  }
}

module.exports = WorkerFactory
