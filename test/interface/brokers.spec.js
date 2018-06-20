const _ = require("underscore")
const brokers = require("../../lib/brokers")


describe("brokers interface", () => {

  const instances = _(brokers).keys().map(k => 
    ({ name: k, instance:  new brokers[k]({ validate: false }) })
  )
 
  instances.forEach(broker => {
    const { name , instance } = broker 
    describe(`${name} methods`, () => {
      it("#publish", () => {
        expect(instance.publish).to.be.a("Function")
      })

      it("#consume", () => {
        expect(instance.consume).to.be.a("Function")
      })

      it("#requeue", () => {
        expect(instance.consume).to.be.a("Function")
      })

      it("#remove", () => {
        expect(instance.consume).to.be.a("Function")
      })
    })
  })
})