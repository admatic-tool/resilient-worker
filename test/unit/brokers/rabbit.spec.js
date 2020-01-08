const sinon = require('sinon')

const RabbitBroker = require('../../../lib/brokers/rabbit')

describe('RabbitBroker', () => {
  context('._getPublisherChannel', () => {
    context('when _publisherChannel is null', () => {
      let resolvedChannel
      let newChannelStub
      let rabbit
      let result

      before(function*() {
        rabbit = new RabbitBroker({ validate: false })
        const on = sinon.fake()

        resolvedChannel = { on }

        newChannelStub = sinon
          .stub(rabbit, '_newChannel')
          .resolves(resolvedChannel)

        result = yield rabbit._getPublisherChannel()
      })

      it('should try to create new channel', () => {
        expect(newChannelStub.called).to.be.true
      })

      it('should populate _publisherChannel variable', () => {
        expect(rabbit._getPublisherChannel).to.not.be.null
      })

      it('should attach a callback to the created channel', () => {
        expect(resolvedChannel.on.calledOnce).to.be.true
      })

      it('should create the channel', () => {
        expect(result).to.be.eql(resolvedChannel)
      })

      after(() => {
        newChannelStub.restore()
      })
    })
  })

  context('.publish', () => {})

  context('.consume', () => {})

  context('.requeue', () => {})

  context('.stop', () => {})
})
