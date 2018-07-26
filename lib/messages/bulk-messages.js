"use strict"

/**
 * @module messages/bulk-messages
 * @class BulkMessages
 */
module.exports = class BulkMessages {

  /**
   *
   * @param { Message[] } messages
   */
  constructor(messages) {
    this.messages = [ ...messages ]
  }

  /**
   * @returns {Number}
   */
  size() {
    return this.messages.length
  }

  /**
   * @returns {Number}
   */
  count() {
    return this.size()
  }

  /**
   * @returns {Object[]}
   */
  payloads() {
    return this.map(msg => msg.parsedContent())
  }

  /**
   * @param {Function} callback
   */
  forEach(callback) {
    this.messages.forEach(callback)
  }

  /**
   * @param {Function} callback
   * @return {Object[]}
   */
  map(callback) {
    return this.messages.map(callback)
  }

  /**
   * @param {Function} callback
   * @returns {BulkMessages}
   */
  filter(callback) {
    return new BulkMessages(this.messages.filter(callback))
  }

  /**
   * @returns {BulkMessages}
   */
  getSuccessMessages() {
    return this.filter(msg => msg.isSuccess())
  }

  /**
   * @returns {BulkMessages}
   */
  getFailMessages() {
    return this.filter(msg => msg.isFail())
  }

  /**
   * @param {Error} error
   * @returns {BulkMessages}
   */
  failAll(error) {
    return new BulkMessage(this.messages.map(msg => msg.failMessage(error)))
  }

  /**
   * ! destrutive
   * @param {Error} error
   */
  setAllFailed(error) {
    this.messages = this.messages.map(msg => msg.failMessage(error))
  }

  /**
   * ! destrutive
   * @param {String | Message} messageIdOrMessage
   * @param {Error} error
  */
  setFailed(messageIdOrMessage, error) {
    const messageId = messageIdOrMessage.messageId ? messageIdOrMessage.messageId() : value

    this.messages = this.messages.map(msg =>
      (msg.messageId() === messageId) ? msg.failMessage(error) : msg
    )
  }
}
