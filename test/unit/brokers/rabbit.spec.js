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
        expect(newChannelStub.calledOnce).to.be.true
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
        sinon.restore()
      })
    })

    context('subsequent calls to _getPublisherChannel', () => {
      let resolvedChannel
      let newChannelStub
      let rabbit
      let result
      let result2

      before(function*() {
        rabbit = new RabbitBroker({ validate: false })
        const on = sinon.fake()

        resolvedChannel = { on }

        newChannelStub = sinon
          .stub(rabbit, '_newChannel')
          .resolves(resolvedChannel)

        result = yield rabbit._getPublisherChannel()

        result2 = yield rabbit._getPublisherChannel()
      })

      it('should try to create new channel', () => {
        expect(newChannelStub.calledOnce).to.be.true
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

      it('should return the same channel on the second call', () => {
        expect(result2).to.be.eql(resolvedChannel)
      })

      after(() => {
        newChannelStub.restore()
      })
    })
  })

  context('.publish', () => {
    context('when _getPublisherChannel throws error', () => {
      it('should not swallow error', function*() {
        const rabbit = new RabbitBroker({ validate: false })

        sinon.stub(rabbit, '_getPublisherChannel').throws('Test error')

        try {
          yield rabbit.publish()
          expect.fail("publish didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.name).to.be.eql('Test error')
        }
      })

      after(() => {
        sinon.restore()
      })
    })

    context('when neither exchange, routing key or queue are provided', () => {
      it('should throw error', function*() {
        const rabbit = new RabbitBroker({ validate: false })

        sinon.stub(rabbit, '_getPublisherChannel').resolves()

        try {
          yield rabbit.publish()
          expect.fail("publish didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.message).to.be.eql(
            'no exchange & routingKey specified or a simple queue'
          )
        }
      })
    })

    context('when exchange and routing key are provided', () => {
      const publishIn = { exchange: 'anExchange', routingKey: 'aRoutingKey' }
      const message = { my: 'mesage' }
      const executionId = '123'
      const tryCount = 0

      context('when publishing fails', () => {
        it('should not swallow error', function*() {
          const rabbit = new RabbitBroker({
            validate: false,
            publishIn
          })

          const channelPublishStub = sinon.stub().throws('Test rabbit error')

          sinon
            .stub(rabbit, '_getPublisherChannel')
            .resolves({ publish: channelPublishStub })

          try {
            yield rabbit.publish(message, executionId, tryCount)
            expect.fail("publish didn't throw an error")
          } catch (err) {
            expect(err).to.be.an('Error')
            expect(err.name).to.be.eql('Test rabbit error')
          }
        })

        after(() => {
          sinon.restore()
        })
      })
      let result

      let channelPublishFake
      let getPublisherChannelStub

      before(function*() {
        const rabbit = new RabbitBroker({
          validate: false,
          publishIn
        })

        channelPublishFake = sinon.fake()

        getPublisherChannelStub = sinon
          .stub(rabbit, '_getPublisherChannel')
          .resolves({ publish: channelPublishFake })

        result = yield rabbit.publish(message, executionId, tryCount)
      })

      it('should return true', () => {
        expect(result).to.be.true
      })

      it('should call _getPublisherChannel', () => {
        expect(getPublisherChannelStub.calledOnce).to.be.true
      })

      it('should call publish', () => {
        expect(channelPublishFake.calledOnce).to.be.true
      })

      it('should call publish with the correct parameters', () => {
        expect(
          channelPublishFake.calledWithMatch(
            publishIn.exchange,
            publishIn.routingKey,
            sinon.match.instanceOf(Buffer),
            {
              headers: {
                try_count: tryCount
              },
              messageId: executionId,
              persistent: true
            }
          )
        ).to.be.true
      })
    })
  })

  context('.consume', () => {})

  context('.requeue', () => {})

  context('.stop', () => {})

  context('.validate', () => {})
})
