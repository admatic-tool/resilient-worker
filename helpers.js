const co = require("co")

const executeNext = (argument, scene, i = 1) => {
  const steps = scene.filter(e => e.order === i)

  if(steps.length > 0) {
    if (steps.length === 1) {
      return co(function*() {
        try {
          const resp = yield steps[0].call(argument)
          return executeNext(resp, scene, ++i)
        } catch(err) {
          err.step = i
          err.argument = argument 
          throw err
        }
      })

    } else {
      return co(function*() {
        try {
          const resp = yield steps.map(s => s.call(argument))
          return executeNext(resp, scene, ++i)
        } catch(err) {
          err.step = i
          err.argument = argument 
          throw err
        }
      })
    }
  } else {
    return argument
  }
}

module.exports = { executeNext }