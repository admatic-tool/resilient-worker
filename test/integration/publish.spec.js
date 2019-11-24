"use strict"

/* global RabbitHelper */

const WorkerFactory = require("../../lib/index")

describe("publish", () => {

  after(() => RabbitHelper.build())

  context("by routingKey", () => {

    let msg
    before(function*() {

      yield RabbitHelper.build()
      const { publish } = WorkerFactory.createWorker({
        connectUrl: "amqp://localhost",
        name: "PubExample",
        publishIn: {
          routingKey: "clicks",
          exchange: "app_test",
        },
        callback: doc => doc,
      })

      yield publish({ a: "b" })
      msg = yield RabbitHelper.getFrom("clicks_warehouse", { remove: true })
    })

    it("message should be delivered in correct queue", function*() {
      expect(msg).to.not.be.false
    })

    it("should publish the correct content", () => {
      expect(msg.content.toString()).to.be.equal("{\"a\":\"b\"}")
    })

    it("should be a persistent message", () => {
      expect(msg.properties.deliveryMode).to.be.equal(2)
    })

  })

  context("by queue", () => {

    let msg
    before(function*() {

      yield RabbitHelper.build()

      const { publish } = WorkerFactory.createWorker({
        connectUrl: "amqp://localhost",
        name: "PubExample",
        queue: "clicks_warehouse",
        callback: doc => doc,
      })

      yield publish({ a: "b" })

      msg = yield RabbitHelper.getFrom("clicks_warehouse", { remove: true })
    })

    it("message should be delivered in correct queue", function*() {
      expect(msg).to.not.be.false
    })

    it("should publish the correct content", () => {
      expect(msg.content.toString()).to.be.equal("{\"a\":\"b\"}")
    })

    it("should be a persistent message", () => {
      expect(msg.properties.deliveryMode).to.be.equal(2)
    })
  })
})
