
const co = require("co")
const amqplib = require("amqplib")
const rabbitTestFactory = require("rabbit-test-helper")

const config = {
  url: "amqp://localhost",
  exchange: { 
    name: "app_test",
    routingKeys: [
      { 
        name: "clicks", 
        queues: [
          "clicks_warehouse"
        ] 
      }
    ]
  }
}

// generate a helper to build a rabbit objects
global.RabbitHelper = rabbitTestFactory(config)
global.expect = require("chai").expect
global.waitSeconds = seconds =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000))