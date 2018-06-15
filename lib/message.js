"use strict"
const uuidv4 = require("uuid/v4")

module.exports = class Message {

  constructor(attrs, original) {
    this.attrs = attrs
    this.original = original
  }

  toString() {
    return this.attrs.content.toString()
  }

  parsedContent() {
    return JSON.parse(this.toString())
  }

  bufferContent() {
    return new Buffer(this.toString())
  }

  count() {
    return this.attrs.count || 1
  }

  nextCount() {
    return this.count() + 1
  }

  messageId() {
    return this.attrs.messageId || uuidv4()
  }

  getOriginal() {
    return this.original
  }
}
