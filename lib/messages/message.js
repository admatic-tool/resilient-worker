"use strict"
const uuidv4 = require("uuid/v4")
const _ = require("underscore")


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
    this.original = original
    this.callbacks = callbacks
    _(this).assign(callbacks)
  }

  /**
   * @returns {Object}
   */
  getAttribute(attrName) {
    return _(this._attrs[attrName]).clone()
  }

  /**
   * @param {String} attrName
   * @param {Object} payload
   */
  setAttribute(attrName, payload) {
    this._attrs[attrName] = _(payload).clone()
  }

  /**
   * @returns {Message} this message
   */
  setSuccess(payload = {}) {
    this._attrs.error = false
    this.setAttribute("payload", payload)
    return this
  }

  /**
   * @returns {Object}
   */
  getSuccessPayload() {
    return this.getAttribute("payload")
  }

  /**
   *
   * @param {Error} error
   * @returns {Message} this message
   */
  setFail(err = Error("unknow error")) {
    this._attrs.error = err
    return this
  }

  /**
   * @returns {Boolean}
   */
  isSuccess() {
    return !this.isFail()
  }

  /**
   * @returns {Error}
   */
  getError() {
    return this._attrs.error
  }

  /**
   * @returns {Boolean}
   */
  isFail() {
    return !!this.getError()
  }

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
    return new Buffer(this.toString())
  }

  /**
   *  @returns {Number} number of tries of proccessing message
   */
  count() {
    return this._attrs.count || 1
  }

  /**
   *  @returns {Number} next try number of proccessing message
   */
  nextCount() {
    return this.count() + 1
  }

  /**
   * @returns {String} identification string os a message, genereted in the first time it was created
   */
  messageId() {
    return this._attrs.messageId || uuidv4()
  }

  getOriginal() {
    return this.original
  }
}
