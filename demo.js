//const Blink1 = require('node-blink1')
const Leap = require('leapjs')
const b = require('baudio')
const debug = require('debug')
const throttle = require('lodash.throttle')

// TODO: use blink1 HID instead of API server?
const defaults = Object.freeze({
  API: process.env.API || 'blink1',
  LED: process.env.LED || 'http://127.0.0.1:8934',
  LOG: process.env.LOG || '@hagemt/colors:demo',
  OFF: '000000',
  RTT: 0.05,
  harmonic: false,
  noise: 0,
  quiet: process.env.SOX === '0',
})

const delay = async (ms = 1000) => {
  await new Promise((done) => setTimeout(done, ms))
}

// NOTE: doot makes funky space noises at various pitches
const MAGIC_NUMBER = 262 // sounds like a record scratch
const doot = (pitch = MAGIC_NUMBER) => {
  let n = 0
  const a = b((t) => {
    const x = Math.sin(t * pitch + Math.sin(n))
    n += Math.sin(t)
    return x
  })
  a.play()
}

/*
const pitches = Array.from({ length: 100 }, (_, i) => MAGIC_NUMBER + 10 * i)
for (const pitch of pitches) doot(pitch) // this does something very strange
*/

const log = Object.freeze({
  debug: debug(defaults.LOG),
  error: (...args) => {
    console.error(...args)
    //log.debug(...args)
  },
})

class SendError extends Error {
  constructor(msg, res, err) {
    if (err) {
      super(`${err.cause?.code ?? err.code ?? err} from: ${msg}`)
      this.code = err.cause?.code ?? err.code ?? 'ECONNREFUSED'
    } else if (res) {
      super(`${res.status} ${res.statusText} on request: ${msg}`)
    } else {
      super(`failed to connect to API / parse JSON; why: ${msg}`)
    }
    this.cause = err
    Object.defineProperty(this, 'res', { value: res })
    Object.freeze(this)
  }
}

const send = async (hex, base = defaults.LED, time = defaults.RTT) => {
  // if the program is about to end, send should be a no-op
  const rgb = `#${send.hex || hex}`
  log.debug('sending color:', rgb)
  let res = null

  const href = `${base}/blink1/fadeToRGB?rgb=${encodeURIComponent(rgb)}&time=${time}`
  const start = process.hrtime()
  try {
    res = await fetch(href) // usually 200 OK or 400 Bad Request
    if (!res.ok) throw new SendError(`send color ${rgb}`, res, null)
    const { lastColor } = await res.json()
    // should match prior hex value:
    return lastColor
  } catch (err) {
    if (err instanceof SendError) throw err
    // usually fetch's TypeError or SyntaxError
    throw new SendError(`send color ${rgb}`, res, err)
  } finally {
    const [s, ns] = process.hrtime(start) // elapsed wall clock
    const ms = (s * 1e3 + ns / 1e6).toFixed(0).padStart(3)
    log.debug('took ~%sms to GET %s', ms, href)
  }
}

const selfTest = () => {
  /*
  const [id1] = Blink1.devices()
  const blink1 = new Blink1(id1)
  */
  //const blink1 = new Blink1()
  /*
  return send('ffffff')
    .then(() => doot())
    .then(() => send(defaults.OFF))
    .catch(() => process.exit(1)) // eslint-disable-line no-process-exit
  */
  doot()
}

// NOTE: uncomment Leap to enable motion controls, vs. calling scale() for simulated inputs
const handWave = async (c = defaults) => {
  // https://en.wikipedia.org/wiki/Just_intonation (generate music in Western 12 tone, no particular scale)
  const [HIGH, LOW, M, N, O] = [400, 100, 2, 0, 440] // A4 is O=440 Hz (plus M=2 octaves, no N=phase shift)
  const just = (f, phase = 0) => (phase + O) * Math.pow(2, (Math.floor(f * 12 * M) + N) / 12)

  // number of steps (half tones) is inverse of just intonation (offset ratio from base key)
  const step = (hz, base = 0) => Math.round(12 * Math.log2(hz / (base + O)) - N) // f*12M
  const norm = (all, nil = 0) => all.length / all.reduce((lhs, rhs) => lhs + 1 / rhs, nil)
  const form = (v, width = 8) => ((v < 0 ? '' : '+') + v).padEnd(width)
  const nfix = (v, n = 0, width = 4) => v.toFixed(n).padStart(width)

  // from hand's palm position in 3-D box, synth a waveform
  const play = ([x, y, z], r = (LOW + HIGH) / 2) => {
    const fx = (r + x) / (2 * r)
    const fy = (y - LOW) / (HIGH - LOW)
    const fz = (r + z) / (2 * r)
    // play nothing if any axis is outside "the box"
    if ([fx, fy, fz].some((f) => f < 0 || f > 1)) return
    const [xhz, yhz, zhz] = [fx, fy, fz].map((f) => just(f))
    //log.debug('x%smm => %s Hz [%s%s half tone(s)]', form(x), nfix(xhz), O, form(step(xhz), 3))
    log.debug('y%smm => %s Hz [%s%s half tone(s)]', form(y), nfix(yhz), O, form(step(yhz), 3))
    //log.debug('z%smm => %s Hz [%s%s half tone(s)]', form(z), nfix(zhz), O, form(step(zhz), 3))
    const a = b((t /*,n,8192 samples in ~186.159090ms*/) => {
      const noise = c.noise ? c.noise * Math.random() : 0
      const notes = c.harmonic ? [xhz, yhz, zhz] : [yhz]
      const hz = norm(notes, noise) // \in [-1, 1]
      return Math.sin(2 * Math.PI * t * hz)
    })
    try {
      a.play()
    } catch (err) {
      log.error(err)
    }
  }

  // the coordinates in HSB/HSL must transform into RGB vector components
  const box = (k, s = 0.5, l = 0.5) => {
    const a = s * Math.min(l, 1 - l)
    const b = Math.min(k - 3, 9 - k)
    return l - a * Math.max(-1, Math.min(b, 1))
  }
  const toHexColor = ({ id, palmPosition, type }, min = 100, max = 400) => {
    const y = Number(palmPosition[1]).toFixed()
    log.debug('%s hand %s: y%smm', type, id, form(y, 4))
    if (y < min || y > max) return '000000'
    if (!c.quiet) play(palmPosition)

    const hue = ((y - min) / (max - min)) * 360 // in degrees
    const r = Math.floor(0xff * box((0 + hue / 30) % 12))
    const g = Math.floor(0xff * box((8 + hue / 30) % 12))
    const b = Math.floor(0xff * box((4 + hue / 30) % 12))
    const hex = [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
    log.debug('hand@%smm => #%s [HSB: hue=%s deg]', form(y, 4), hex, nfix(hue, 2, 6))
    return hex
  }

  const handleEvent = ({ hands }) => {
    for (const hand of hands) {
      const hex = toHexColor(hand)
      send(hex).catch(log.error)
    }
  }
  // simulates regular hand movement, avoiding deep reds
  const scale = async (ms = 300, step = 10) => {
    const [min, max] = [100, 390] // vs. 0/100 to 400
    const hand = {
      id: 0, // real hand IDs are positive, monotonic?
      palmPosition: [0, min, 0],
      type: 'mock',
    }
    log.debug('hand: %j (palm to %s)', hand, max)
    while (!send.hex) {
      await delay(ms)
      hand.palmPosition[1] += step
      if (hand.palmPosition[1] > max) {
        hand.palmPosition[1] = min
      }
      handleEvent({
        hands: [hand],
      })
    }
  }

  // NOTE: LeapJS doesn't appear to work on Apple Silicon yet
  if (c.API === 'leapjs') {
    Leap.loop(throttle(handleEvent, 1000 * c.RTT))
  } else {
    scale()
  }
}

module.exports = {
  handWave,
  selfTest,
}

const main = async () => {
  await send(defaults.OFF)
  selfTest()
  await delay(900)
  handWave()
}

if (module === require.main) {
  const off = async () => send(defaults.OFF).catch((err) => log.error(err.message))
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      send.hex = defaults.OFF
      await delay(600)
      await off()
      process.kill(process.pid, signal)
    })
  }
  main().catch(async (err) => {
    process.exitCode = 1
    send.hex = defaults.OFF
    log.error('[FATAL]', err.message)
    if (err.code !== 'ECONNREFUSED') await off()
  })
}
