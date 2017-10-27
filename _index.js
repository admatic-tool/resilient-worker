

const co = require("co")
const amqplib = require("amqplib")

const queue = "job_example_queue"
const LIMIT_RETRY = 3

co(function*() {
  const conn = yield amqplib.connect('amqp://localhost')

  console.log("conn ok")
  
  const ch = yield conn.createChannel()
  const ok = yield ch.assertQueue(queue)

  if(ok) {
    console.log("queue ok")
    ch.consume(queue, msg => {
      co(function*() {
        const message = JSON.parse(msg.content.toString())
        
        try {
          console.dir(msg.properties.headers)
          console.log("try")
          randomFail(8)
          console.log("sucess")

        } catch (err) {

          console.log("fail")

          if (message.retry) 
            ++message.retry
          else 
            message.retry = 1

          console.log(message)

          if (message.retry < LIMIT_RETRY) {
            ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))
          }

        } finally {
          ch.ack(msg)
        }
      })
    })
  }
})

function randomFail(chanceOfFail) {
  const [ min, max ] = [ 1 , 10 ]
  const event = Math.random() * (max - min) + min
  console.log(event, chanceOfFail)
  if(event <= chanceOfFail)
    throw Error("random error")
}


/* worker 

WorkerFactory

{
  queue,
  enqueue,
  max_retry,
  run(msg) {
   ...
  }
}

(req, res) => {

  const { click } = req.body
  
  worker.enqueue(click)

  res.json({ msg: "accepted" })

}

//
run() { 
  co(function*() {

    try {

      yeild worker.callback()

    } catch (err) {

      if (message.retry) 
        ++message.retry
      else 
        message.retry = 1

      if (message.retry < LIMIT_RETRY)
        ch.sendToQueue(queue, new Buffer(JSON.stringify(message)))

    } finally {
      ch.ack(msg)
    }
  })
}
*/

