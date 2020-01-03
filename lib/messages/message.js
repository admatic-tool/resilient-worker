const uuidv4 = require('uuid/v4')
const _ = require('underscore')

const defaultError = Error('unknown error')

/**
 * @module messages/message
 * @class Message
 */
module.exports = class Message {
  /**
   *
   * @param {{messageId: String, count: Number, content: Object }} attrs
   * @param {Object} callbacks
   * @param {Object} original
   */
  constructor(attrs, callbacks, original) {
    this._attrs = attrs
    this._attrs.messageId = this._attrs.messageId || uuidv4()

    this.continueOnError = true

    this.original = original
    this.callbacks = callbacks

    _(this).assign(callbacks)
  }

  /**
   * @returns {Object}
   */
  _getAttribute(attrName) {
    return _(this._attrs[attrName]).clone()
  }

  /**
   * @param {String} attrName
   * @param {Object} payload
   */
  _setAttribute(attrName, payload) {
    this._attrs[attrName] = _(payload).clone()
  }

  /**
   * @returns {Message} this message
   */
  setSuccess(payload = {}) {
    delete this._attrs.error
    this._setAttribute('payload', payload)
    return this
  }

  setIgnore(reason = null) {
    this._attrs.ignoreReason = reason
    return this
  }

  /**
   * @returns {Object}
   */
  getSuccessPayload() {
    return this._getAttribute('payload')
  }

  doNotContinueTry() {
    this.continueOnError = false
    return this
  }

  /**
   * @param {Error} error
   * @returns {Message} this message
   */
  setFail(err = defaultError, markDoNotContinueTry = false) {
    if (markDoNotContinueTry) this.doNotContinueTry()

    this._attrs.error = err
    return this
  }

  /**
   * @returns {Error}
   */
  getError() {
    return this._attrs.error
  }

  /**
   * These are lifecycle methods: isFail(), isSuccess(), isIgnored(), isContinueOnError()
   * are used intenally by resilient-worker to control message lifecycle status.
   */

  /**
   * @returns {Boolean}
   */
  isFail() {
    return !!this.getError()
  }

  /**
   * @returns {Boolean}
   */
  isSuccess() {
    return !this.isFail()
  }

  /**
   * @returns {Boolean}
   */
  isIgnored() {
    return !!this._attrs.ignoreReason
  }

  /**
   * @returns {Boolean}
   */
  isContinueOnError() {
    return !!this.continueOnError
  }

  /**
   * @returns {String}
   */
  toString() {
    return this._attrs.content.toString()
  }

  /**
   * @returns {Object} represent the payload of message
   */
  getParsedContent() {
    return JSON.parse(this.toString())
  }

  /**
   *  @returns {Buffer} represent the payload of message
   */
  getBufferContent() {
    return Buffer.from(this.toString())
  }

  /**
   *  @returns {Number} number of tries of proccessing message
   */
  tryCount() {
    return this._attrs.count || 1
  }

  /**
   *  @returns {Number} next try number of proccessing message
   */
  nextTryCount() {
    return this.tryCount() + 1
  }

  /**
   * @returns {String} identification string of a message, generated in the first time it was created
   */
  messageId() {
    return this._attrs.messageId
  }

  getOriginal() {
    return this.original
  }
}
