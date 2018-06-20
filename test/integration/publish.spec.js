

const WorkerFactory = require("../../lib/index")

describe("publish", () => {

  after(RabbitHelper.build)

  context("by routingKey", () => {
    let publish
    
    before(function*() {
  
      yield RabbitHelper.build()
      const { publish } = WorkerFactory.createWorker({
        connectUrl: "amqp://localhost",
        name: "PubExample",
        publishIn: {
          routingKey: "clicks",
          exchange: "app_test"
        },
        callback: doc => doc
      })

      yield publish({ a: "b" })
    })
  
    it("message should be delivered in correct queue", function*() {
      const msg = yield RabbitHelper.getFrom("clicks_warehouse", { remove: true })
      expect(msg.content.toString()).to.be.equal('{"a":"b"}')
    })
  })

  context("by queue", () => {

    let publish
    
    before(function*() {
  
      yield RabbitHelper.build()
  
      const { publish } = WorkerFactory.createWorker({
        connectUrl: "amqp://localhost",
        name: "PubExample",
        queue: "clicks_warehouse",
        callback: doc => doc
      })
  
      yield publish({ a: "b" })
    })

    it("message should be delivered in correct queue", function*() {
      const msg = yield RabbitHelper.getFrom("clicks_warehouse", { remove: true })
      expect(msg.content.toString()).to.be.equal('{"a":"b"}')
    })
  })
})