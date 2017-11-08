

const WorkerFactory = require("../index")
const sinon = require("sinon")
const co = require("co")

describe("publish", () => {


  const workerMeta = {
    queue: "clicks_warehouse",
    max_try: 4,
    callback: null ,
    failCallback: null,
    successCallback: null
  }

  context("success", () => {

    let attrs
    after(RabbitHelper.build)
    
    before(function*() {
      // clone
      attrs = JSON.parse(JSON.stringify(workerMeta))

      attrs.callback =        sinon.spy(() => Promise.resolve(true))
      attrs.successCallback = sinon.spy(() => Promise.resolve(true))
      attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

      yield RabbitHelper.build()

      yield RabbitHelper.sendTo("clicks", JSON.stringify({a: 1 }))

      const workerFactory = WorkerFactory("amqp://localhost")
      const { worker } = workerFactory.createWorker(attrs)

      worker.start()

      for (let i = 0; i < 20; ++i)
        yield waitSeconds(.01)
    })
  
    it("callback run one time", () => {
      expect(attrs.callback.callCount).to.be.equal(1)
    })

    it("successCallback run one time", () => {
      expect(attrs.successCallback.callCount).to.be.equal(1)
    })

    it("failCallback run none times", () => {
      expect(attrs.failCallback.callCount).to.be.equal(0)
    })
  })


  context("fail", () => {
    
    let attrs
    after(RabbitHelper.build)
    
    before(function*() {
      // clone
      attrs = JSON.parse(JSON.stringify(workerMeta))

      attrs.callback = sinon.spy(() => { 
        throw new Error("errão !")
      })

      attrs.successCallback = sinon.spy(() => Promise.resolve(true))
      attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

      yield RabbitHelper.build()

      yield RabbitHelper.sendTo("clicks", JSON.stringify({ a: 1 }))

      const workerFactory = WorkerFactory("amqp://localhost")
      const { worker } = workerFactory.createWorker(attrs)

      worker.start()

      for (let i = 0; i < 40; ++i)
        yield waitSeconds(.01)
    })
  
    it("callback run max_tries times", () => {
      expect(attrs.callback.callCount).to.be.equal(4)
    })

    it("successCallback run none time", () => {
      expect(attrs.successCallback.callCount).to.be.equal(0)
    })

    it("failCallback run one times", () => {
      expect(attrs.failCallback.callCount).to.be.equal(1)
    })
  })
})



