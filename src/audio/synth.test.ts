import { describe, expect, it } from 'vitest'
import { SOUND_IDS, SOUND_RECIPES } from '../data/sounds'
import { MAX_VOICES, SynthEngine, playSound, resetSynthForTests, setSynthForTests } from './synth'

function param() {
  return {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
    setTargetAtTime() {},
  }
}

interface FakeSource {
  started: number
  stopped: number
  onended: (() => void) | null
}

/** Just enough AudioContext surface for SynthEngine. */
function fakeContext() {
  const sources: FakeSource[] = []
  let buffers = 0
  const node = () => ({ connect() {}, disconnect() {} })
  const ctx = {
    currentTime: 0,
    sampleRate: 100,
    createGain: () => ({ ...node(), gain: param() }),
    createBuffer: (_c: number, length: number) => {
      buffers++
      return { getChannelData: () => new Float32Array(length) }
    },
    createBufferSource() {
      const s: FakeSource & ReturnType<typeof node> = {
        ...node(),
        started: 0,
        stopped: 0,
        onended: null,
        buffer: null,
        loop: false,
        start() {
          s.started++
        },
        stop() {
          s.stopped++
        },
      } as never
      sources.push(s)
      return s
    },
    createOscillator() {
      const s = {
        ...node(),
        started: 0,
        stopped: 0,
        onended: null,
        type: 'sine',
        frequency: param(),
        start() {
          s.started++
        },
        stop() {
          s.stopped++
        },
      }
      sources.push(s as FakeSource)
      return s
    },
    createBiquadFilter: () => ({ ...node(), type: '', Q: param(), frequency: param() }),
    createPanner: () => ({
      ...node(),
      positionX: param(),
      positionY: param(),
      positionZ: param(),
      panningModel: '',
      distanceModel: '',
      maxDistance: 0,
    }),
  }
  return { ctx: ctx as unknown as AudioContext, sources, buffers: () => buffers }
}

function makeEngine() {
  const f = fakeContext()
  const engine = new SynthEngine(f.ctx, { connect() {} } as unknown as AudioNode)
  return { ...f, engine }
}

describe('SynthEngine', () => {
  it('plays every recipe in the table', () => {
    const { engine } = makeEngine()
    for (const id of SOUND_IDS) expect(engine.play(id, { x: 0, y: 0, z: 0 }), id).toBe(true)
  })

  it('refuses an unknown sound id without throwing', () => {
    const { engine } = makeEngine()
    expect(engine.play('nope' as never)).toBe(false)
    expect(engine.voiceCount).toBe(0)
  })

  it('caps voices at 16 and cuts the oldest first', () => {
    const { engine, sources } = makeEngine()
    const layers = SOUND_RECIPES['revolver-shot'].layers.length
    for (let i = 0; i < MAX_VOICES; i++) engine.play('revolver-shot')
    expect(engine.voiceCount).toBe(MAX_VOICES)
    const firstVoiceSources = sources.slice(0, layers)
    // Each source has its scheduled stop() only.
    expect(firstVoiceSources.every((s) => s.stopped === 1)).toBe(true)
    engine.play('revolver-shot')
    expect(engine.voiceCount).toBe(MAX_VOICES)
    // The oldest voice got an extra stop() on top of its scheduled one; the newest did not.
    expect(firstVoiceSources.every((s) => s.stopped === 2)).toBe(true)
    expect(sources.slice(layers, layers * 2).every((s) => s.stopped === 1)).toBe(true)
    const newest = sources.slice(-layers)
    expect(newest.every((s) => s.stopped === 1)).toBe(true)
  })

  it('frees a voice when its source ends', () => {
    const { engine, sources } = makeEngine()
    engine.play('dodge')
    expect(engine.voiceCount).toBe(1)
    sources[0].onended?.()
    expect(engine.voiceCount).toBe(0)
  })

  it('shares one noise buffer across voices', () => {
    const { engine, buffers } = makeEngine()
    engine.play('dodge')
    engine.play('dodge')
    expect(buffers()).toBe(1)
  })
})

describe('playSound', () => {
  it('does nothing before audio is unlocked', () => {
    resetSynthForTests()
    expect(() => playSound('kick')).not.toThrow()
  })

  it('swallows engine failures', () => {
    const { engine } = makeEngine()
    engine.play = () => {
      throw new Error('boom')
    }
    setSynthForTests(engine)
    expect(() => playSound('kick')).not.toThrow()
    resetSynthForTests()
  })
})
