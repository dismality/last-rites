import { beforeEach, describe, expect, it } from 'vitest'
import { SYNTH_MUSIC } from '../data/music'
import { resetMusicForTests, stepMusic } from './music'
import { resetSynthForTests, setSynthForTests, SynthEngine } from './synth'

function fakeGain() {
  const calls: number[] = []
  return {
    calls,
    gain: {
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      setTargetAtTime(v: number) {
        calls.push(v)
      },
    },
    connect() {},
  }
}

function fakeParam() {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  }
}

function fakeCtx(state: string) {
  const gains: ReturnType<typeof fakeGain>[] = []
  const oscs: {
    type: string
    frequency: ReturnType<typeof fakeParam>
    starts: number[]
    connect(): void
    start(t?: number): void
    stop(): void
  }[] = []
  return {
    gains,
    oscs,
    state,
    currentTime: 0,
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: fakeParam(),
        starts: [] as number[],
        connect() {},
        start(t = 0) {
          o.starts.push(t)
        },
        stop() {},
      }
      oscs.push(o)
      return o
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: fakeParam(), connect() {} }
    },
    createGain() {
      const g = fakeGain()
      gains.push(g)
      return g
    },
  }
}

function setup(state: string) {
  const ctx = fakeCtx(state)
  setSynthForTests(
    new SynthEngine(ctx as unknown as AudioContext, { connect() {} } as unknown as AudioNode),
  )
  return ctx
}

describe('music driver core', () => {
  beforeEach(() => {
    resetMusicForTests()
    resetSynthForTests()
  })

  it('builds no graph while the context is suspended, then starts when it runs', () => {
    const ctx = setup('suspended')
    const before = ctx.gains.length // sfx + music buses
    expect(stepMusic({ stems: [1, 0, 0, 0], master: 1 })).toBe(false)
    expect(ctx.gains.length).toBe(before)
    ctx.state = 'running'
    expect(stepMusic({ stems: [1, 0, 0, 0], master: 1 })).toBe(true)
    const built = ctx.gains.length
    const oscCount = ctx.oscs.length
    expect(built).toBeGreaterThan(before + 4)
    expect(oscCount).toBeGreaterThan(0)
    stepMusic({ stems: [1, 0, 0, 0], master: 1 })
    expect(ctx.gains.length).toBe(built)
    expect(ctx.oscs.length).toBe(oscCount)
  })

  it('does nothing before audio is unlocked', () => {
    expect(stepMusic({ stems: [1, 1, 1, 1], master: 1 })).toBe(false)
  })

  it('follows the runtime: stems scale by peak, master is clamped', () => {
    const ctx = setup('running')
    stepMusic({ stems: [1, 0.5, 0, 1], master: 2 })
    const peaks = SYNTH_MUSIC.stemPeaks
    // gains: sfx, music bus, master, then the four stems
    expect(ctx.gains.slice(2, 7).map((g) => g.calls[g.calls.length - 1])).toEqual([
      1,
      peaks[0],
      peaks[1] * 0.5,
      0,
      peaks[3],
    ])
  })

  it('schedules two heartbeat thuds 0.22 s apart while danger is above 0.05, none below', () => {
    const ctx = setup('running')
    stepMusic({ stems: [1, 1, 1, 0.04], master: 1 })
    const base = ctx.oscs.length
    stepMusic({ stems: [1, 1, 1, 0.04], master: 1 })
    expect(ctx.oscs.length).toBe(base)
    stepMusic({ stems: [1, 1, 1, 1], master: 1 })
    const thuds = ctx.oscs.slice(base).map((o) => o.starts[0])
    expect(thuds).toHaveLength(2)
    expect(thuds[1] - thuds[0]).toBeCloseTo(SYNTH_MUSIC.heartbeat.thudGapS, 5)
    stepMusic({ stems: [1, 1, 1, 1], master: 1, frozen: true })
    expect(ctx.oscs.length).toBe(base + 2)
  })
})
