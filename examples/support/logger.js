const BgReset = '\x1b[0m'

const FgRed = '\x1b[31m'
const FgYellow = '\x1b[33m'
const FgCyan = '\x1b[36m'
const FgWhiteBright = '\x1b[97m'

// logger object
module.exports = tag => ({
  info(args) {
    console.log(
      FgCyan,
      JSON.stringify({ level: 'info', tag, ...args }),
      BgReset
    )
  },
  debug(args) {
    console.log(
      FgWhiteBright,
      JSON.stringify({ level: 'debug', tag, ...args }),
      BgReset
    )
  },
  warn(args) {
    console.log(
      FgYellow,
      JSON.stringify({ level: 'warn', tag, ...args }),
      BgReset
    )
  },
  error(args) {
    console.log(
      FgRed,
      JSON.stringify({ level: 'error', tag, ...args }),
      BgReset
    )
  }
})
