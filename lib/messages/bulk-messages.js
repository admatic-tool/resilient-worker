

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

  forEach(callback) {
   this.messages.forEach(callback)
  }

  map(callback) {
    return this.messages.map(callback)
  }

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

  setFailed(value, error) {

    const messageId = value.messageId ? value.messageId() : value

    this.messages = this.messages.map(msg =>
      (msg.messageId() === messageId) ? msg.failMessage(error) : msg
    )
  }
}