"use strict"

const Message = require("../../lib/messages/message")
const BulkMessages = require("../../lib/messages/bulk-messages")

describe("BulkMessages", () => {
  const message = new Message({ messageId: "123", count: 5, content: { a: 1 }})

  describe("constructor", () => {
    const messages = new BulkMessages([ message ])
  })
})
