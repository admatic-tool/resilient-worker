"use strict"

/* global RabbitHelper */

const WorkerFactory = require("../../lib/index")
const sinon = require("sinon")

describe("worker", () => {


  const workerMeta = {
    connectUrl: "amqp://localhost",
    name: "TestWorker",
    queue: "clicks_warehouse",
    max_try: 4,
    callback: null,
    failCallback: null,
    successCallback: null,
  }

  const msgPublished = JSON.stringify({a: 1})

  context("success", () => {

    context("callback returns a promise.", () => {
      let attrs

      after(() => RabbitHelper.build())

      before(function*() {
        // clone
        attrs = JSON.parse(JSON.stringify(workerMeta))

        attrs.callback =        sinon.spy(() => Promise.resolve(true))
        attrs.successCallback = sinon.spy(() => Promise.resolve(true))
        attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

        yield RabbitHelper.build()

        yield RabbitHelper.sendTo("clicks", msgPublished)

        const { worker } = WorkerFactory.createWorker(attrs)

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

      it("should call successCallback with the message payload", () => {
        expect(attrs.successCallback
          .calledWith(sinon.match(args =>
            args.length == 1 && args[0].toString() == msgPublished
          ))
        ).to.be.true
      })

      it("failCallback run none times", () => {
        expect(attrs.failCallback.callCount).to.be.equal(0)
      })
    })

    context("callback returns a promise that resolves with the messages", () => {
      let attrs

      after(() => RabbitHelper.build())

      before(function*() {
        // clone
        attrs = JSON.parse(JSON.stringify(workerMeta))

        attrs.callback =        sinon.spy(messages => {
          messages.map(msg => msg.setSuccess(`success: ${msg.toString()}`))
          Promise.resolve(messages)
        })
        attrs.successCallback = sinon.spy(() => Promise.resolve(true))
        attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

        yield RabbitHelper.build()

        yield RabbitHelper.sendTo("clicks", msgPublished)

        const { worker } = WorkerFactory.createWorker(attrs)

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

      it("should call successCallback with messages returned", () => {
        expect(attrs.successCallback
          .calledWith(sinon.match(args =>
            args.length == 1 && args[0].getSuccessPayload() == `success: ${msgPublished}`
          ))
        ).to.be.true
      })

      it("failCallback run none times", () => {
        expect(attrs.failCallback.callCount).to.be.equal(0)
      })
    })

    context("callback returns the resulting messages", () => {
      let attrs

      after(() => RabbitHelper.build())

      before(function*() {
        // clone
        attrs = JSON.parse(JSON.stringify(workerMeta))

        attrs.callback =        sinon.spy(messages => messages.map(msg => msg.setSuccess(`success: ${msg.toString()}`)))
        attrs.successCallback = sinon.spy(() => Promise.resolve(true))
        attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

        yield RabbitHelper.build()

        yield RabbitHelper.sendTo("clicks", msgPublished)

        const { worker } = WorkerFactory.createWorker(attrs)

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

      it("should call successCallback with messages returned", () => {
        expect(attrs.successCallback
          .calledWith(sinon.match(args =>
            args.length == 1 && args[0].getSuccessPayload() == `success: ${msgPublished}`
          ))
        ).to.be.true
      })

      it("failCallback run none times", () => {
        expect(attrs.failCallback.callCount).to.be.equal(0)
      })
    })

    context("callback returns whatever", () => {
      let attrs

      after(() => RabbitHelper.build())

      before(function*() {
        // clone
        attrs = JSON.parse(JSON.stringify(workerMeta))

        attrs.callback =        sinon.spy(() => "asd")
        attrs.successCallback = sinon.spy(() => Promise.resolve(true))
        attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

        yield RabbitHelper.build()

        yield RabbitHelper.sendTo("clicks", msgPublished)

        const { worker } = WorkerFactory.createWorker(attrs)

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

      it("should call successCallback with the message payload", () => {
        expect(attrs.successCallback
          .calledWith(sinon.match(args =>
            args.length == 1 && args[0].toString() == msgPublished
          ))
        ).to.be.true
      })

      it("failCallback run none times", () => {
        expect(attrs.failCallback.callCount).to.be.equal(0)
      })
    })


  })


  context("fail", () => {

    let attrs
    after(() => RabbitHelper.build())

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

      const { worker } = WorkerFactory.createWorker(attrs)

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

  context("cancel", () => {

    let attrs
    after(() => RabbitHelper.build())

    before(function*() {
      // clone
      attrs = JSON.parse(JSON.stringify(workerMeta))

      attrs.callback = sinon.spy(messages => messages.map(msg => msg.ignore(new Error("foo err"))))

      attrs.successCallback = sinon.spy(() => Promise.resolve(true))
      attrs.failCallback =    sinon.spy(() => Promise.resolve(true))

      yield RabbitHelper.build()

      yield RabbitHelper.sendTo("clicks", JSON.stringify({ a: 1 }))

      const { worker } = WorkerFactory.createWorker(attrs)

      worker.start()

      for (let i = 0; i < 40; ++i)
        yield waitSeconds(.01)
    })

    it("callback runs one time", () => {
      expect(attrs.callback.callCount).to.be.equal(1)
    })

    it("successCallback doesn't run", () => {
      expect(attrs.successCallback.callCount).to.be.equal(0)
    })

    it("failCallback runs one time", () => {
      expect(attrs.failCallback.callCount).to.be.equal(1)
    })
  })
})
