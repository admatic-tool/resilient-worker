const uuidv4 = require('uuid/v4')
const { EventEmitter } = require('events')

const brokers = {
  rabbit: './brokers/rabbit/',
  sqs: './brokers/sqs/'
}

const Loop = class Loop {
  constructor(callback, timeMillis) {
    this.callback = callback
    this.timeMillis = timeMillis
  }

  start() {
    this.stop()
    this.timer = setInterval(this.callback, this.timeMillis)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
  }
}

const WorkerFactory = {
  _configure(opts) {
    const {
      broker = 'rabbit',
      exitOnCancel = true,
      retry_timeout = 0,
      bulkSize = 1,
      prefetch = bulkSize || 1,
      bulkFlushIntervalInSeconds = 10,
      validate = true
    } = opts

    return Object.assign(
      {
        broker,
        exitOnCancel,
        retry_timeout,
        bulkSize,
        prefetch: prefetch >= bulkSize ? prefetch : bulkSize,
        bulkFlushIntervalInSeconds,
        validate
      },
      opts
    )
  },

  /**
   * Creates a new worker instance
   * @param {Object} opts
   * @param {boolean} [opts.validate=true] - Whether to validate options
   * @param {('rabbit'|'sqs')} [opts.broker=rabbitmq] - Broker to used
   * @param {boolean} [opts.exitOnCancel=true] - If true, consumer will trigger process.exit on a worker:cancel event
   * @param {function} opts.callback - Function that will handle the message list
   * @param {string} opts.name - Name of this consumer
   * @param {function} [opts.successCallback] - Function to be executed after success on callback
   * @param {function} [opts.failCallback] - Function to be executed after callback failure
   * @param {number} [opts.max_try] - Maximum times a message will be try to be consumed
   * @param {number} [opts.retry_timeout=0] - Timeout before requeuing messages
   * @param {number} [opts.prefetch=1] - How many messages will be received at once from the broker
   * @param {number} [opts.bulkSize=1] - Maximum messages will be processed by the callback in bulk
   * @param {number} [opts.bulkFlushIntervalInSeconds=10] - Interval in seconds to send a incomplete bulk to the callback
   * @param {string} opts.queue - Queue to consume from
   * @param {string} [opts.connectUrl] - Connection URL (only for rabbit broker)
   * @param {string} [opts.queueOptions] - Options of the queue to be asserted (only for rabbit broker)
   * @param {object} [opts.aws]
   * @param {string} [opts.aws.region] - AWS Region of the SQS queue (only for sqs broker)
   *
   */
  createWorker(opts) {
    const config = this._configure(opts)

    const {
      broker,
      exitOnCancel,
      callback,
      name,
      successCallback,
      failCallback,
      max_try: maxTries,
      retry_timeout: retryTimeout,
      bulkSize,
      bulkFlushIntervalInSeconds
    } = config

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const BrokerClass = require(brokers[broker])
    const emitter = new EventEmitter()
    const _broker = new BrokerClass(config)

    const worker = {
      _status: 'STOPPED',
      _loop: null,

      /**
       * Attaches a callback to event triggered by the consumer
       * @param {string} event Event to be listened to
       * @param {function} cb Callback to be executed on event trigger
       */
      on(event, cb) {
        emitter.on(event, cb)
      },

      log(level, msg, message, ...resources) {
        emitter.emit(...['log', name, level, msg, message, ...resources])
      },

      /**
       * Stops the consumer
       * @returns {Promise<void>}
       */
      stop() {
        this._status = 'STOPPING'
        this.log('info', [], 'worker:shutdown')
        if (this._loop) {
          this._loop.stop()
        }
        return _broker.stop().then(() => {
          this._status = 'STOPPED'
          const logListeners = emitter.listeners('log')

          emitter.removeAllListeners()
          logListeners.map(listener => emitter.on('log', listener))
        })
      },

      /**
       * Starts the consumer
       *
       * @returns {Promise<void>}
       */
      start() {
        if (this._status === 'STOPPED') this._status = 'STARTING'
        else throw new Error('worker is not on STOPPED state')

        const { log } = this

        const messageAccumulator = []

        this._loop = new Loop(() => {
          if (messageAccumulator.length > 0) {
            log('debug', messageAccumulator, 'bulk:flush (timeout)')
            emitter.emit('bulk:flush', messageAccumulator.splice(0, bulkSize))
          }
        }, bulkFlushIntervalInSeconds * 1000)

        this._loop.start()

        emitter.on('worker:cancel', (exit = false) => {
          log('debug', [], 'worker:cancel')

          this.stop().then(() => {
            if (exit) {
              log('error', [], 'worker:exit')
              process.exit(-1)
            }
          })
        })

        emitter.on('msg:received:checked', msg => {
          log('debug', [msg], 'msg:received:checked')

          messageAccumulator.push(msg)
          if (messageAccumulator.length >= bulkSize) {
            log('debug', messageAccumulator, 'bulk:flush (bulkSize)')
            emitter.emit('bulk:flush', messageAccumulator.splice(0, bulkSize))
          }
        })

        // TODO - validate message on receive
        emitter.on('msg:received', msg => {
          if (msg === null) {
            log('debug', [], 'cancelled')
            emitter.emit('worker:cancel', exitOnCancel)
            return
          }

          emitter.emit('msg:received:checked', msg)
        })

        emitter.on('bulk:flush', messages => {
          this._loop.start()

          try {
            /**
             * can return positive, falsy or an array of messages inside a Promise or not
             */
            const execution = callback(messages)

            if (execution && execution.then) {
              // Returned a promise
              execution
                .then(successMessages => {
                  if (successMessages && successMessages.map)
                    emitter.emit('bulk:processed', successMessages)
                  else emitter.emit('bulk:processed', messages)
                })
                .catch(err => {
                  emitter.emit(
                    'bulk:processed',
                    messages.map(message => message.setFail(err))
                  )
                })
            } else if (execution && execution.map) {
              // Returned messages
              emitter.emit('bulk:processed', execution)
            } else {
              emitter.emit('bulk:processed', messages) // Returned other value
            }
          } catch (err) {
            emitter.emit(
              'bulk:processed',
              messages.map(message => message.setFail(err))
            )
          }
        })

        emitter.on('bulk:processed', messages => {
          const tryFailMessages = []
          const successMessages = []

          for (const message of messages.filter(msg => !msg.isIgnored())) {
            if (message.isSuccess()) {
              successMessages.push(message)
            } else {
              tryFailMessages.push(message)
            }
          }

          log('debug', successMessages, 'before successCallback')
          log('debug', tryFailMessages, 'before tryFailCallback')

          emitter.emit('bulk:try:success', successMessages)
          emitter.emit('bulk:try:fail', tryFailMessages)
          emitter.emit('bulk:try:end', messages)
        })

        emitter.on('bulk:try:success', messages => {
          if (successCallback && messages.length > 0)
            try {
              const execution = successCallback(messages)

              if (execution && execution.then)
                execution
                  .then(res => log('info', messages, 'successCallback', res))
                  .catch(err => log('error', messages, 'successCallback', err))
              else log('info', messages, 'successCallback', execution)
            } catch (err) {
              log('error', messages, 'successCallback', err)
            }
        })

        emitter.on('bulk:try:fail', messages => {
          if (messages.length === 0) return

          const messagesToRetry = messages.filter(
            msg => msg.tryCount() < maxTries && msg.isContinueOnError()
          )

          emitter.emit('bulk:try:retry', messagesToRetry)

          const messagesToCancel = messages.filter(
            msg => msg.tryCount() >= maxTries || !msg.isContinueOnError()
          )

          emitter.emit('bulk:try:cancel', messagesToCancel)
        })

        emitter.on('bulk:try:cancel', messages => {
          if (failCallback && messages.length > 0)
            try {
              const execution = failCallback(messages)

              if (execution && execution.then)
                execution
                  .then(res => log('info', messages, 'failCallback', res))
                  .catch(err => log('error', messages, 'failCallback', err))
              else log('info', messages, 'failCallback', execution)
            } catch (err) {
              log('error', messages, 'failCallback', err)
            }
        })

        emitter.on('bulk:try:retry', messages => {
          if (messages.length === 0) return

          setTimeout(() => {
            messages.map(msg => _broker.requeue(msg))
            log('debug', messages, 'requeued')
          }, retryTimeout)
        })

        emitter.on('bulk:try:end', messages =>
          messages.forEach(message => {
            setImmediate(
              (msg, fn) => {
                fn('debug', [msg], 'remove')
                try {
                  _broker.remove(msg)
                } catch (err) {
                  fn('error', [msg], 'remove', err)
                }
              },
              message,
              log
            )
          })
        )

        return _broker
          .consume(msg => emitter.emit('msg:received', msg))
          .then(() => {
            this._status = 'STARTED'
            log('debug', [], 'broker started')
          })
          .catch(err => {
            log('error', [], 'broker started', err)
            emitter.emit('worker:cancel', true)
          })
      }
    }

    /**
     * Publishes a message to be consumed by this worker
     * @param {Object} doc message
     * @returns {Promise<boolean>} whether the message was published successfuly
     */
    const publish = doc => _broker.publish(doc, uuidv4(), 1)

    return {
      worker,
      publish
    }
  }
}

module.exports = WorkerFactory
