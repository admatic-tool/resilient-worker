

module.exports = class BulkMessages {

  constructor(messages) {
    this.messages = [ ...messages ]
  }

  size() {
    return this.messages.length
  }

  count() {
    return this.size()
  }

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
   */
  map(callback) {
    return this.messages.map(callback)
  }

  /**
   * @param {Function} callback
   */
  filter(callback) {
    return new BulkMessages(this.messages.filter(callback))
  }

  getSuccessMessages() {
    return this.filter(msg => msg.isSuccess())
  }

  getFailMessages() {
    return this.filter(msg => msg.isFail())
  }

  setAllFailed(error) {
    this.messages = this.messages.map(msg => msg.failMessage(error))
  }

  /**
   * @param {string | Message} value
   * @param {Error} error
  */
  setFailed(value, error) {
    const messageId = value.messageId ? value.messageId() : value

    this.messages = this.messages.map(msg =>
      (msg.messageId() === messageId) ? msg.failMessage(error) : msg
    )
  }
}
