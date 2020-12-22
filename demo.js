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

const handWave = async (c = { harmonic: false, noise: 0, quiet: process.env.SOX === '0' }) => {
  // https://en.wikipedia.org/wiki/Just_intonation (generate music in Western 12 tone, no particular scale)
  const [HIGH, LOW, M, N, O] = [400, 100, 2, 0, 440] // A4 is O=440 Hz (plus M=2 octaves, no N=phase shift)
  const just = (f, phase = 0) => (phase + O) * Math.pow(2, (Math.floor(f * 12 * M) + N) / 12)
  // number of steps (half tones) is inverse of just intonation (offset ratio from base key)
  const step = (hz, base = 0) => Math.round(12 * Math.log2(hz / (base + O)) - N) // f*12M
  const norm = (all, nil = 0) => all.length / all.reduce((lhs, rhs) => lhs + 1 / rhs, nil)
  const form = (v, width = 8) => ((v < 0 ? '' : '+') + v).padEnd(width)
  // from hand's palm position in 3-D box, synth a waveform
  const play = ([x, y, z], r = (LOW + HIGH) / 2) => {
    const fx = (r + x) / (2 * r)
    const fy = (y - LOW) / (HIGH - LOW)
    const fz = (r + z) / (2 * r)
    // play nothing if any axis is outside "the box"
    if ([fx, fy, fz].some((f) => f < 0 || f > 1)) return
    const [xhz, yhz, zhz] = [fx, fy, fz].map((f) => just(f))
    log.debug('x%smm => %s Hz [%s+%s half tone(s)]', form(x), xhz, O, step(xhz))
    log.debug('y%smm => %s Hz [%s+%s half tone(s)]', form(y), yhz, O, step(yhz))
    log.debug('z%smm => %s Hz [%s+%s half tone(s)]', form(z), zhz, O, step(zhz))
    const a = b((t /*,n,8192 samples in ~186.159090ms*/) => {
      const noise = c.noise ? c.noise * Math.random() : 0
      const notes = c.harmonic ? [xhz, yhz, zhz] : [yhz]
      const hz = norm(notes, noise) // \in [-1, 1]
      return Math.sin(2 * Math.PI * t * hz)
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
    log.debug('%s hand %s: y%smm', type, id, form(y, 4))
    if (y < min || y > max) return '000000'
    if (!c.quiet) play(palmPosition)

    const hue = 360 * ((y - min) / (max - min)) // in degrees
    const r = Math.floor(0xff * rgb((0 + hue / 30) % 12))
    const g = Math.floor(0xff * rgb((8 + hue / 30) % 12))
    const b = Math.floor(0xff * rgb((4 + hue / 30) % 12))
    const hex = [r, g, b].map((c) => (c < 16 ? '0' : '') + c.toString(16)).join('')
    log.debug('y%smm => #%s [hue:%s deg]', form(y, 4), hex, hue.toFixed(2).padStart(7))
    return hex
  }

  const _rtt = 0.05 // in seconds; TODO: use HID instead of API over HTTP
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
  await send('000000') // start w/ the lights off
  Leap.loop(_.throttle(handleEvent, 1000 * _rtt))
}

module.exports = {
  handWave,
  selfTest,
}

if (!module.parent) {
  selfTest()
  handWave()
}
