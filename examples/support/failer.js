const failInTime = n => ({
  n: 0,
  fail() {
    this.n += 1
    if (this.n === n) throw new Error(`error in time ${n}`)
  }
})

const failInTen = n => {
  const [min, max] = [1, 10]
  const event = Math.random() * (max - min) + min
  if (event <= n) throw Error('random error')
}

module.exports = {
  failInTime,
  failInTen
}
