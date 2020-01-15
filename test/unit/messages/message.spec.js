const Message = require('../../../lib/messages/message')

describe('Message', () => {
  const msg = new Message(
    {
      count: 2,
      messageId: 'abc',
      content: Buffer.from(JSON.stringify({ a: 2 }))
    },
    {
      callback1: () => true
    },
    {
      specificAttribute: 1
    }
  )

  describe('#toString', () => {
    it('convert contant to String', () =>
      expect(msg.toString()).to.be.equal('{"a":2}'))
  })

  describe('#getParsedContent', () => {
    it('return a content copy', () =>
      expect(msg.getParsedContent()).to.be.eqls({ a: 2 }))
  })

  describe('#getBufferContent', () => {})

  describe('#tryCount', () => {
    it('should be the atual message try count', () =>
      expect(msg.tryCount()).to.be.equal(2))
  })

  describe('#nextTryCount', () => {
    it('should be the next message try count', () =>
      expect(msg.nextTryCount()).to.be.equal(3))
  })

  describe('#messageId', () => {
    it('shoud return the internal messageId', () =>
      expect(msg.messageId()).to.be.equal('abc'))
  })

  describe('#getOriginal', () => {
    it('return the original Object', () =>
      expect(msg.getOriginal()).to.be.eqls({
        specificAttribute: 1
      }))
  })
})
