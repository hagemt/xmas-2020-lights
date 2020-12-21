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

const handWave = async (audio = true) => {
  // https://en.wikipedia.org/wiki/Just_intonation
  const just = (f, octaves = 2) => Math.pow(2, Math.floor(octaves * 12 * f) / 12)
  const step = (hz, base = 440) => (12 * Math.log2(hz / base)).toFixed().padEnd(2)
  const play = ([x, y, z], r = 250) => {
    const fx = (r + x) / (2 * r)
    const fz = (r + z) / (2 * r)
    if (fx < 0 || fx > 1 || fz < 0 || fz > 1) return
    const xhz = 440 * just(fx) // A=440 Hz (TODO: start C0?)
    const zhz = 440 * just(fz) // FIXME: add relative minor?
    log.debug('x+%smm => %s Hz [A440 +%s half tone(s)]', x, xhz, step(xhz))
    log.debug('y+%smm (will be used for color)', y)
    log.debug('z+%smm => %s Hz [A440 +%s half tone(s)]', z, zhz, step(zhz))
    const a = b((t /*,intervals*/) => {
      const ax = Math.sin(2 * Math.PI * t * xhz)
      const az = Math.sin(2 * Math.PI * t * zhz)
      return ax + az // sum of signals (two notes)
    })
    try {
      a.play()
    } catch (e) {
      log.error(e)
    }
  }

  const rgb = (k, s = 0.5, l = 0.5) => {
    const a = s * Math.min(l, 1 - l)
    const b = Math.min(k - 3, 9 - k)
    return l - a * Math.max(-1, Math.min(b, 1))
  }
  const toHexColor = ({ id, palmPosition, type }, min = 100, max = 400) => {
    const y = Number(palmPosition[1]).toFixed()
    log.debug('%s hand %s: +%smm', type, id, y)
    if (y < min || y > max) return '000000'
    if (audio) play(palmPosition)

    const hue = 360 * ((y - min) / (max - min)) // in degrees
    const r = Math.floor(0xff * rgb((0 + hue / 30) % 12))
    const g = Math.floor(0xff * rgb((8 + hue / 30) % 12))
    const b = Math.floor(0xff * rgb((4 + hue / 30) % 12))
    const hex = [r, g, b].map((c) => (c < 16 ? '0' : '') + c.toString(16)).join('')
    log.debug('y+%smm => #%s [hue:%s deg]', y, hex, hue.toFixed(2).padStart(7))
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
  const audio = process.env.SOX !== '0'
  selfTest() // ready
  handWave(audio)
}
