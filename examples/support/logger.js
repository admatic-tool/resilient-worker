"use strict"

const BgReset = "\x1b[0m"

const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgYellow = "\x1b[33m"

// logger object
module.exports = tag => ({
  info(...args) {
    console.log(FgGreen, tag, ...args, BgReset)
  },
  debug(...args) {
    console.log(FgGreen, tag, ...args, BgReset)
  },
  error(...args) {
    console.error(FgRed, tag, ...args, BgReset)
  },
})
