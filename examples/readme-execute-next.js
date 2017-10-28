
const { executeNext } = require("../helpers")

const middlewareActions = [
  { 
    order: 1, 
    call: names => Promise.resolve([ names, "hello" ]) 
  },
  { 
    order: 2, 
    call: ([ names, message ]) =>
      Promise.resolve([ names.join(), message ].join(", "))
  },
]

// the argument is a string, wich no have .join() method
executeNext("luiz", middlewareActions ).catch(err => {
  /* error has a aditional metadata,about a 
    - step that error occurs
    - the argument that step worker

    with this, it can be restarted
  */
  console.error("error in step", 
                err.step,
                "with", 
                err.argument, 
                "received")

  const [ name, message ] = err.argument
  executeNext([[name], message], middlewareActions, err.step).then(res => {
    console.log(res)
   // "luiz, hello"
  })
})