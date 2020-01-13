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

      context('when publish with success', () => {
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

        after(() => {
          sinon.restore()
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

    context('when queue is provided', () => {
      const queue = 'my_queue'
      const message = { my: 'mesage2' }
      const executionId = '123'
      const tryCount = 0

      context('when assertQueue throws', () => {
        it('should not swallow error', function*() {
          const rabbit = new RabbitBroker({
            queue,
            validate: false
          })

          const ch = { publish: () => 'blah' }
          sinon.stub(rabbit, '_getPublisherChannel').resolves(ch)

          sinon.stub(rabbit, '_assertQueue').throws('Unknown test error')

          try {
            yield rabbit.publish(message, executionId, tryCount)
            expect.fail("publish didn't throw an error")
          } catch (err) {
            expect(err).to.be.an('Error')
            expect(err.name).to.be.eql('Unknown test error')
          }

          after(() => {
            sinon.restore()
          })
        })
      })

      context('when assertQueue returns false', () => {
        it('should throw error', function*() {
          const rabbit = new RabbitBroker({
            queue,
            validate: false
          })

          const ch = { publish: () => 'blah' }
          sinon.stub(rabbit, '_getPublisherChannel').resolves(ch)

          sinon.stub(rabbit, '_assertQueue').resolves(false)

          try {
            yield rabbit.publish(message, executionId, tryCount)
            expect.fail("publish didn't throw an error")
          } catch (err) {
            expect(err).to.be.an('Error')
            expect(err.message).to.be.eql(`queue not match ${queue}`)
          }

          after(() => {
            sinon.restore()
          })
        })
      })

      context('when sending to queue fails', () => {
        it('should not swallow error', function*() {
          const rabbit = new RabbitBroker({
            validate: false,
            queue
          })

          const channelSendToQueueStub = sinon
            .stub()
            .throws('Test rabbit error')

          sinon.stub(rabbit, '_assertQueue').resolves(true)

          sinon
            .stub(rabbit, '_getPublisherChannel')
            .resolves({ sendToQueue: channelSendToQueueStub })

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

      context('when sending to queue with success', () => {
        let assertQueueStub
        let channelSendToQueueFake
        let getPublisherChannelStub
        let resolvedChannel
        let result

        before(function*() {
          const rabbit = new RabbitBroker({
            validate: false,
            queue
          })

          channelSendToQueueFake = sinon.fake()

          assertQueueStub = sinon.stub(rabbit, '_assertQueue').resolves(true)

          resolvedChannel = { sendToQueue: channelSendToQueueFake }

          getPublisherChannelStub = sinon
            .stub(rabbit, '_getPublisherChannel')
            .resolves(resolvedChannel)

          result = yield rabbit.publish(message, executionId, tryCount)
        })

        it('should return true', () => {
          expect(result).to.be.true
        })

        it('should call _getPublisherChannel', () => {
          expect(getPublisherChannelStub.calledOnce).to.be.true
        })

        it('should call _assertQueue with channel', () => {
          expect(assertQueueStub.calledOnceWithExactly(resolvedChannel)).to.be
            .true
        })
        it('should call sendToQueue', () => {
          expect(channelSendToQueueFake.calledOnce).to.be.true
        })

        it('should call sendToQueue with the correct parameters', () => {
          expect(
            channelSendToQueueFake.calledWithMatch(
              queue,
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

        after(() => {
          sinon.restore()
        })
      })
    })
  })

  context('.consume', () => {
    context('when _consumerTag is set', () => {
      it('should throw error', function*() {
        const queue = 'consume'

        const rabbit = new RabbitBroker({
          validate: false,
          queue
        })

        const consumerTag = 'blah'
        rabbit._consumerTag = consumerTag

        try {
          yield rabbit.consume()
          expect.fail("consume didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.message).to.be.eql(
            `Worker is already consuming queue ${queue}. consumer tag: ${consumerTag}`
          )
        }
      })

      after(() => {
        sinon.restore()
      })
    })

    context('when _newChannel throws error', () => {
      it('should not swallow error', function*() {
        const rabbit = new RabbitBroker({
          validate: false
        })

        sinon.stub(rabbit, '_newChannel').throws('Test newchannel error')

        try {
          yield rabbit.consume()
          expect.fail("consume didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.name).to.be.eql('Test newchannel error')
        }
      })

      after(() => {
        sinon.restore()
      })
    })

    context('when consume with sucess', () => {
      let handleConsumerEventsStub
      let newChannelStub
      let prefetchFake
      let rabbit
      let result
      let consumeFake
      let ch
      const queue = 'consume'
      const prefetch = 99
      const consumeResult = {
        consumerTag: 'my-tag'
      }
      const callback = () => true

      before(function*() {
        rabbit = new RabbitBroker({
          validate: false,
          queue,
          prefetch
        })

        prefetchFake = sinon.fake()
        consumeFake = sinon.fake.resolves(consumeResult)

        ch = {
          prefetch: prefetchFake,
          consume: consumeFake
        }

        handleConsumerEventsStub = sinon.stub(rabbit, '_handleConsumerEvents')

        newChannelStub = sinon.stub(rabbit, '_newChannel').resolves(ch)

        result = yield rabbit.consume(callback)
      })

      it('should return undefined', () => {
        expect(result).to.be.undefined
      })

      it('should create channel', () => {
        expect(newChannelStub.calledOnce).to.be.true
      })

      it('should set prefetch', () => {
        expect(prefetchFake.calledOnceWithExactly(prefetch)).to.be.true
      })

      it('should call consume', () => {
        expect(consumeFake.calledOnce).to.be.true
      })

      it('should call consume with correct parameters', () => {
        expect(consumeFake.calledWithMatch(queue, sinon.match.func)).to.be.true
      })

      it('should set consumerTag', () => {
        expect(rabbit._consumerTag).to.be.eql(consumeResult.consumerTag)
      })

      it('should set _consumerChannel', () => {
        expect(rabbit._consumerChannel).to.be.eql(ch)
      })

      it('should call _handleConsumerEvents', () => {
        expect(handleConsumerEventsStub.calledOnce).to.be.true
      })

      it('should call _handleConsumerEvents with correct parameters', () => {
        expect(
          handleConsumerEventsStub.calledOnceWithExactly(
            ch,
            consumeResult.consumerTag,
            callback
          )
        ).to.be.true
      })

      after(() => {
        sinon.restore()
      })
    })
  })

  context('.requeue', () => {
    const queue = 'requeue'
    context('when _getPublisherChannel fails', () => {
      it('should not swallow error', function*() {
        const rabbit = new RabbitBroker({ validate: false })

        sinon.stub(rabbit, '_getPublisherChannel').throws('Test error')

        try {
          yield rabbit.requeue()
          expect.fail("requeue didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.name).to.be.eql('Test error')
        }
      })

      after(() => {
        sinon.restore()
      })
    })

    context('when _assertQueue fails', () => {
      it('should not swallow error', function*() {
        const rabbit = new RabbitBroker({ validate: false })

        sinon.stub(rabbit, '_getPublisherChannel').resolves()

        sinon.stub(rabbit, '_assertQueue').throws('Test error')

        try {
          yield rabbit.requeue()
          expect.fail("requeue didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.name).to.be.eql('Test error')
        }
      })
    })

    context('when _assertQueue returns false', () => {
      it('should throw error', function*() {
        const rabbit = new RabbitBroker({
          queue,
          validate: false
        })

        const ch = { publish: () => 'blah' }
        sinon.stub(rabbit, '_getPublisherChannel').resolves(ch)

        sinon.stub(rabbit, '_assertQueue').resolves(false)

        try {
          yield rabbit.requeue()
          expect.fail("requeue didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.message).to.be.eql(`queue not match ${queue}`)
        }

        after(() => {
          sinon.restore()
        })
      })
    })

    context('when sendToQueue fails', () => {
      it('should not swallow error', function*() {
        const rabbit = new RabbitBroker({
          validate: false,
          queue
        })

        const msg = {
          getBufferContent: sinon.fake(),
          nextTryCount: sinon.fake(),
          messageId: sinon.fake()
        }

        const sendToQueueFake = sinon.fake.throws('Test rabbit error')

        sinon
          .stub(rabbit, '_getPublisherChannel')
          .resolves({ sendToQueue: sendToQueueFake })

        sinon.stub(rabbit, '_assertQueue').resolves(true)

        sinon.stub(console, 'error')

        try {
          yield rabbit.requeue(msg)
          expect.fail("requeue didn't throw an error")
        } catch (err) {
          expect(err).to.be.an('Error')
          expect(err.message).to.be.eql('Test rabbit error')

          expect(console.error.calledOnceWithExactly(err)).to.be.true
        }
      })

      after(() => {
        sinon.restore()
      })
    })

    context('when requeue with success', () => {
      const expectedMsg = {
        bufferContent: 'content',
        nextTryCount: 10,
        messageId: '991991919'
      }

      let assertQueueStub
      let channelSendToQueueFake
      let getPublisherChannelStub
      let msg
      let result
      let resolvedChannel

      before(function*() {
        const rabbit = new RabbitBroker({
          validate: false,
          queue
        })

        msg = {
          getBufferContent: sinon.fake.returns(expectedMsg.bufferContent),
          nextTryCount: sinon.fake.returns(expectedMsg.nextTryCount),
          messageId: sinon.fake.returns(expectedMsg.messageId)
        }

        channelSendToQueueFake = sinon.fake()

        assertQueueStub = sinon.stub(rabbit, '_assertQueue').resolves(true)

        resolvedChannel = { sendToQueue: channelSendToQueueFake }

        getPublisherChannelStub = sinon
          .stub(rabbit, '_getPublisherChannel')
          .resolves(resolvedChannel)

        result = yield rabbit.requeue(msg)
      })

      it('should return true', () => {
        expect(result).to.be.true
      })

      it('should call _getPublisherChannel', () => {
        expect(getPublisherChannelStub.calledOnce).to.be.true
      })

      it('should call _assertQueue with channel', () => {
        expect(assertQueueStub.calledOnceWithExactly(resolvedChannel)).to.be
          .true
      })
      it('should call sendToQueue', () => {
        expect(channelSendToQueueFake.calledOnce).to.be.true
      })

      it('should call sendToQueue with the correct parameters', () => {
        expect(
          channelSendToQueueFake.calledOnceWithExactly(
            queue,
            expectedMsg.bufferContent,
            {
              headers: {
                try_count: expectedMsg.nextTryCount
              },
              messageId: expectedMsg.messageId,
              persistent: true
            }
          )
        ).to.be.true
      })

      after(() => {
        sinon.restore()
      })
    })
  })

  context('.stop', () => {
    context('when it is not consuming', () => {
      it('should resolve as true', function*() {
        const rabbit = new RabbitBroker({
          validate: false
        })

        const result = yield rabbit.stop()

        expect(result).to.be.true
      })
    })

    context('when there is consumerChannel', () => {
      context('when channel.cancel throws error', () => {
        const consumerTag = 'my-tag-123'
        let consumerChannel
        let rabbit

        before(function*() {
          rabbit = new RabbitBroker({
            validate: false
          })

          const cancelFake = sinon.fake.rejects(new Error('Test cancel fake'))
          const closeFake = sinon.fake()

          const connection = {
            close: sinon.stub()
          }

          consumerChannel = {
            connection,
            cancel: cancelFake,
            close: closeFake
          }

          sinon.stub(rabbit, '_consumerChannel').value(consumerChannel)
          sinon.stub(rabbit, '_consumerTag').value(consumerTag)

          sinon.stub(console, 'error')

          yield rabbit.stop()
        })

        it('should call cancel with consumerTag', () => {
          expect(consumerChannel.cancel.calledOnceWithExactly(consumerTag)).to
            .be.true
        })

        it('should log console.error', () => {
          expect(
            console.error.calledOnceWithExactly(
              `Error when cancelling consumer tag ${consumerTag}`,
              'Test cancel fake'
            )
          ).to.be.true
        })

        it('should not modify consumerTag', () => {
          expect(rabbit._consumerTag).to.be.eql(consumerTag)
        })

        it('should not modify consumerChannel', () => {
          expect(rabbit._consumerChannel).to.be.eql(consumerChannel)
        })

        after(() => {
          sinon.restore()
        })
      })

      context('when cancel with success', () => {
        const consumerTag = 'my-tag-123'
        let channelCloseFake
        let consumerChannel
        let rabbit

        before(function*() {
          rabbit = new RabbitBroker({
            validate: false
          })

          const cancelFake = sinon.fake.resolves()
          channelCloseFake = sinon.fake()

          const connection = {
            close: sinon.stub()
          }

          consumerChannel = {
            connection,
            cancel: cancelFake,
            close: channelCloseFake
          }

          sinon.stub(rabbit, '_consumerChannel').value(consumerChannel)
          sinon.stub(rabbit, '_consumerTag').value(consumerTag)

          yield rabbit.stop()
        })

        it('should call cancel with consumerTag', () => {
          expect(consumerChannel.cancel.calledOnceWithExactly(consumerTag)).to
            .be.true
        })

        it('should try to close channel', () => {
          expect(channelCloseFake.calledOnce).to.be.true
        })

        it('should try to close connection', () => {
          expect(consumerChannel.connection.close.calledOnce).to.be.true
        })

        it('should not set _consumerTag to null', () => {
          expect(rabbit._consumerTag).to.be.null
        })

        it('should not modify _consumerChannel to be null', () => {
          expect(rabbit._consumerChannel).to.be.null
        })

        after(() => {
          sinon.restore()
        })
      })
    })
  })

  context('.validate', () => {})
})
