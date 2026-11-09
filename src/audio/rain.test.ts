import { afterEach, describe, expect, it } from 'vitest'
import { RAIN_NOISE, STORM } from '../data/storms'
import { getRainLevel, resetRainForTests, setRainFrozen, setRainLevel } from './rain'
import { SynthEngine, resetSynthForTests, setSynthForTests } from './synth'

interface Ramp {
  value: number
  at: number
}

function param(initial = 0) {
  const p = {
    value: initial,
    ramps: [] as Ramp[],
    setValueAtTime(v: number) {
      p.value = v
    },
    linearRampToValueAtTime(v: number, at: number) {
      p.ramps.push({ value: v, at })
    },
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {
      p.ramps.length = 0
    },
    setTargetAtTime() {},
  }
  return p
}

const lastRamp = (r: Ramp[]): Ramp | undefined => r[r.length - 1]

function fakeContext() {
  const filters: {
    type: string
    frequency: ReturnType<typeof param>
    Q: ReturnType<typeof param>
  }[] = []
  const gains: { gain: ReturnType<typeof param>; connected: unknown[] }[] = []
  const sources: { loop: boolean; started: number }[] = []
  const ctx = {
    currentTime: 10,
    sampleRate: 100,
    createGain() {
      const g = {
        gain: param(1),
        connected: [] as unknown[],
        connect: (n: unknown) => g.connected.push(n),
        disconnect() {},
      }
      gains.push(g)
      return g
    },
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource() {
      const s = {
        loop: false,
        started: 0,
        buffer: null,
        connect() {},
        disconnect() {},
        start: () => s.started++,
        stop() {},
      }
      sources.push(s)
      return s
    },
    createBiquadFilter() {
      const f = { type: '', frequency: param(), Q: param(), connect() {}, disconnect() {} }
      filters.push(f)
      return f
    },
  }
  return { ctx: ctx as unknown as AudioContext, filters, gains, sources }
}

function setup() {
  const f = fakeContext()
  const engine = new SynthEngine(f.ctx, { connect() {} } as unknown as AudioNode)
  setSynthForTests(engine)
  // The rain gain is the third gain made, after the sfx and music buses.
  return { ...f, engine, rainGain: () => f.gains[2] }
}

afterEach(() => {
  resetRainForTests()
  resetSynthForTests()
})

describe('rain noise', () => {
  it('builds a looped noise graph with the specified filters on the sfx bus', () => {
    const { filters, sources, engine, rainGain } = setup()
    setRainLevel(1)
    expect(sources).toHaveLength(1)
    expect(sources[0].loop).toBe(true)
    expect(sources[0].started).toBe(1)
    const hp = filters.find((f) => f.type === 'highpass')
    const bp = filters.find((f) => f.type === 'bandpass')
    expect(hp?.frequency.value).toBe(500)
    expect(bp?.frequency.value).toBe(2400)
    expect(bp?.Q.value).toBe(0.5)
    expect(rainGain().connected).toContain(engine.sfx)
  })

  it('fades the level to gain 0.22 over 3 s', () => {
    const { rainGain } = setup()
    setRainLevel(1)
    const ramp = lastRamp(rainGain().gain.ramps)
    expect(ramp?.value).toBeCloseTo(RAIN_NOISE.gain)
    expect(ramp?.at).toBeCloseTo(10 + STORM.rainFadeS)
    setRainLevel(0)
    expect(lastRamp(rainGain().gain.ramps)?.value).toBe(0)
  })

  it('mutes quickly while frozen and resumes after', () => {
    const { rainGain } = setup()
    setRainLevel(1)
    setRainFrozen(true)
    const mute = lastRamp(rainGain().gain.ramps)
    expect(mute?.value).toBe(0)
    expect(mute!.at).toBeLessThan(10 + 1)
    setRainFrozen(false)
    expect(lastRamp(rainGain().gain.ramps)?.value).toBeCloseTo(RAIN_NOISE.gain)
  })

  it('sends the sound through the sfx bus so SFX and master volume apply', () => {
    const { engine, rainGain } = setup()
    setRainLevel(1)
    engine.setBusGain('sfx', 0.5)
    // The bus is the only path out; its gain scales the bed and Howler's master gain sits after it.
    expect(rainGain().connected).toEqual([engine.sfx])
  })

  it('is silent and safe when the context is missing, and keeps the level', () => {
    expect(() => setRainLevel(0.6)).not.toThrow()
    expect(() => setRainFrozen(true)).not.toThrow()
    expect(getRainLevel()).toBe(0.6)
  })
})
