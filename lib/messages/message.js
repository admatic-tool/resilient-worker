"use strict"
const uuidv4 = require("uuid/v4")
const _ = require("underscore")

module.exports = class Message {

  constructor(attrs, callbacks, original) {
    this.attrs = attrs
    this.original = original
    this.callbacks = callbacks
    _(this).assign(callbacks)
  }

  getAttribute(attrName) {
    return _(this.attrs[attrName]).clone()
  }

  setAttribute(attrName, payload) {
    this.attrs[attrName] = _(payload).clone()
  }

  successMessage() {
    const { attrs, callbacks, original } = this
    attrs.error = false
    return new Message(attrs, callbacks, original)
  }

  failMessage(err = Error("unknow error")) {
    const { attrs, callbacks, original } = this
    attrs.error = err
    return new Message(attrs, callbacks, original)
  }

  isSuccess() {
    return !this.attrs.error
  }

  getError() {
    return this.attrs.error
  }

  isFail() {
    return !!this.attrs.error
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
