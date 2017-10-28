const { executeNext } = require("../helpers")
const logger = require("./support/logger")("[actor]")
const { failInTime } = require("./support/failer")

const failer = failInTime(2)

const sceneChain = [
  // actors
  { 
    order: 1, 
    call: (args) => {
      logger.debug("first actor (order 1)")
      return new Promise(resolve => {
        failer.fail()
        
        setTimeout(() => 
          resolve(args), 
        500)
      })
    }
  },
  { 
    order: 2,
    // need return a promise
    call: prevRes => {
      logger.debug("second actor (order 2)")
      failer.fail()
      
      return new Promise(resolve => {
        setTimeout(() => 
          resolve(prevRes) , 
        1000)
      })
    }
  },
  { 
    order: 2,
    // need return a promise
    call: prevRes => {
      logger.debug("third actor (order 2)")


      return new Promise(resolve => {
        setTimeout(() => 
          resolve("abv") , 
        3000)
      })
    }
  },
  { 
    order: 3,
    // need return a promise
    call: ([ secondResp , thirdResp ]) => {

      failer.fail()
      
      logger.debug("forty actor (order 3)")
      logger.debug(secondResp, thirdResp)
      return Promise.resolve("ok")
    } 
  },
]

executeNext({ first: "argument" }, sceneChain).catch(err => {
  logger.error(err)
  const { argument, step, message } = err
  logger.debug({ argument, step, message })

  // rexecute
  executeNext(argument, sceneChain, step)
})
