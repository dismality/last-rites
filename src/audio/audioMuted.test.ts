import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const howler = vi.hoisted(() => ({
  mute: vi.fn(),
  volume: vi.fn(),
  pos: vi.fn(),
  orientation: vi.fn(),
  ctx: null as unknown,
  masterGain: null as unknown,
  howlCount: 0,
}))

vi.mock('howler', () => ({
  Howler: howler,
  Howl: class {
    constructor() {
      howler.howlCount++
    }
  },
}))

import { subscribeToType } from '../game/events'
import { emitCombatSound } from '../game/state/combatSounds'
import { setAudioEnabledForTests, AUDIO_ENABLED } from './audioEnabled'
import { playCombatSound, setListener } from './AudioManager'
import { registerCombatSounds } from './audioBoot'
import { SynthEngine, getSynth, resetSynthForTests, setSynthForTests, unlockAudio } from './synth'
import { applyVolumes } from './volumes'

function fakeCtx() {
  const gains: { value: number }[] = []
  const param = () => ({
    value: 0,
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(v: number) {
      this.value = v
    },
  })
  const node = (extra: object = {}) => ({ connect() {}, disconnect() {}, start() {}, stop() {}, ...extra })
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 100,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => node({ loop: false, buffer: null }),
    createBiquadFilter: () => node({ type: 'lowpass', Q: param(), frequency: param() }),
    createOscillator: () => node({ type: 'sine', frequency: param() }),
    createGain: () => {
      const g = param()
      gains.push(g)
      return node({ gain: g })
    },
  }
  return { ctx, gains }
}

beforeEach(() => {
  setAudioEnabledForTests(false)
  for (const fn of [howler.mute, howler.volume, howler.pos, howler.orientation]) fn.mockClear()
  howler.howlCount = 0
})
afterEach(() => {
  setAudioEnabledForTests(true)
  resetSynthForTests()
})

describe('audio muted', () => {
  it('ships muted', () => {
    expect(AUDIO_ENABLED).toBe(false)
  })

  it('unlockAudio builds no engine and creates no Howl', () => {
    howler.ctx = fakeCtx().ctx
    howler.masterGain = {}
    expect(unlockAudio()).toBeNull()
    expect(getSynth()).toBeNull()
    expect(howler.howlCount).toBe(0)
  })

  it('combat sounds start no voices even with an engine installed', () => {
    const { ctx } = fakeCtx()
    const engine = new SynthEngine(ctx as unknown as AudioContext, {} as AudioNode)
    setSynthForTests(engine)
    playCombatSound('revolver-shot')
    expect(engine.voiceCount).toBe(0)
  })

  it('mutes Howler and zeroes the buses, leaving the stored settings alone', () => {
    const { ctx, gains } = fakeCtx()
    setSynthForTests(new SynthEngine(ctx as unknown as AudioContext, {} as AudioNode))
    applyVolumes({ masterVolume: 80, musicVolume: 60, sfxVolume: 80 })
    expect(howler.mute).toHaveBeenLastCalledWith(true)
    expect(howler.volume).toHaveBeenLastCalledWith(0)
    expect(gains[0].value).toBe(0)
    expect(gains[1].value).toBe(0)
  })

  it('does not move the Howler listener', () => {
    setListener([1, 2, 3], 0.5)
    expect(howler.pos).not.toHaveBeenCalled()
  })

  it('still emits captions for combat sounds', () => {
    const texts: string[] = []
    const stop = subscribeToType('subtitleShown', (e) => texts.push(e.text))
    const unregister = registerCombatSounds()
    emitCombatSound('revolver-shot')
    unregister()
    stop()
    expect(texts.length).toBe(1)
  })
})
