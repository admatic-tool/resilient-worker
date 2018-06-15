const Message = require("../../lib/message")

describe("Message", () => {

  const msg = new Message(
    {
      count: 2,
      messageId: "abc",
      content: new Buffer(JSON.stringify({ a: 2 })),
    },
    { 
      specificAttribute: 1
    }
  )
  describe("#toString", () => {
    it("", () => {
      expect(msg.toString()).to.be.equal('{"a":2}')
    })
  })
  describe("#parsedContent", () => {
    it("", () => {
      expect(msg.parsedContent()).to.be.eqls({"a":2 })
    })
  })
  describe("#bufferContent", () => {

  })
  describe("#count", () => {
    it("", () => {
      expect(msg.count()).to.be.equal(2)
    })
  })
  describe("#nextCount", () => {
    it("", () => {
      expect(msg.nextCount()).to.be.equal(3)
    })
  })
  describe("#messageId", () => {
    it("", () => {
      expect(msg.messageId()).to.be.equal("abc")
    })
  })
  describe("#getOriginal", () => {
    it("", () => {
      expect(msg.getOriginal()).to.be.eqls({ 
        specificAttribute: 1
      })
    })
  })
})