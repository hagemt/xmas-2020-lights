//const Blink1 = require('node-blink1')
const Leap = require('leapjs')
const _ = require('lodash')
const b = require('baudio')
const fetch = require('node-fetch')
const debug = require('debug')

const log = Object.freeze({
  debug: debug('hagemt'),
  error: console.error,
})

const selfTest = () => {
  /*
  const [id1] = Blink1.devices()
  const blink1 = new Blink1(id1)
  */
  //const blink1 = new Blink1()
  let n = 0
  const a = b((t) => {
    const x = Math.sin(t * 262 + Math.sin(n))
    n += Math.sin(t)
    return x
  })
  a.play()
}

const handWave = async () => {
  const rgb = (n, hue, s = 0.5, l = 0.5) => {
    const k = (n + hue / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const b = Math.min(k - 3, 9 - k)
    return l - a * Math.max(-1, Math.min(b, 1))
  }
  const toHexColor = ({ id, palmPosition, type }, min = 100, max = 400) => {
    const y = Number(palmPosition[1]).toFixed(3)
    log.debug('%s hand %s: +%smm', type, id, y)
    if (y < min || y > max) return '000000'

    const hue = (y - min) / (max - min) // [0,1]
    const r = Math.floor(0xff * rgb(0, 360 * hue))
    const g = Math.floor(0xff * rgb(8, 360 * hue))
    const b = Math.floor(0xff * rgb(4, 360 * hue))
    const hex = [r, g, b].map((c) => (c < 16 ? '0' : '') + c.toString(16)).join('')
    log.debug('+%smm => #%s [hue %s]', y, hex, hue)
    return hex
  }

  const _rtt = 0.1 // in seconds; TODO: use HID instead of API over HTTP
  const send = async (hex, href = 'http://localhost:8934', time = _rtt) => {
    const url = `${href}/blink1/fadeToRGB?rgb=%23${hex}&time=${time}`
    const res = await fetch(url)
    if (!res.ok) {
      // bad request
      throw new Error(res.status)
    }
    const { lastColor } = await res.json()
    return lastColor // should match hex
  }

  const handleEvent = ({ hands }) => {
    for (const hand of hands) {
      const hex = toHexColor(hand)
      send(hex).catch(log.error)
    }
  }
  await send('000000') // start w/ light off
  Leap.loop(_.throttle(handleEvent, 100))
}

module.exports = {
  handWave,
  selfTest,
}

if (!module.parent) {
  selfTest()
  handWave()
}
