import { afterEach, describe, expect, it } from 'vitest'
import { applyVolumes } from '../../audio/volumes'
import { registerCombatSounds } from '../../audio/audioBoot'
import { stepMusic, resetMusicForTests } from '../../audio/music'
import { resetSynthForTests, setSynthForTests, SynthEngine } from '../../audio/synth'
import { MUSIC } from '../../data/music'
import { subscribeToType } from '../../game/events'
import { initMixer, stepMixer } from '../../game/systems/musicMixer'
import { playThunder } from './weatherRain'

function param(log?: number[]) {
  return {
    value: 0,
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(v: number) {
      log?.push(v)
    },
  }
}

function node(extra: object = {}) {
  return { connect() {}, disconnect() {}, start() {}, stop() {}, ...extra }
}

function fakeCtx() {
  const gainLogs: number[][] = []
  return {
    gainLogs,
    state: 'running',
    currentTime: 0,
    sampleRate: 100,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => node({ loop: false, buffer: null }),
    createBiquadFilter: () => node({ type: 'lowpass', Q: param(), frequency: param() }),
    createOscillator: () => node({ type: 'sine', frequency: param() }),
    createGain: () => {
      const log: number[] = []
      gainLogs.push(log)
      return node({ gain: param(log) })
    },
  }
}

function setup() {
  const ctx = fakeCtx()
  const engine = new SynthEngine(ctx as unknown as AudioContext, { connect() {} } as unknown as AudioNode)
  setSynthForTests(engine)
  return { ctx, engine }
}

afterEach(() => {
  resetSynthForTests()
  resetMusicForTests()
})

describe('thunder on the sfx bus', () => {
  it('plays through the sfx bus, which follows the SFX volume', () => {
    const { ctx, engine } = setup()
    applyVolumes({ masterVolume: 100, musicVolume: 60, sfxVolume: 40 })
    const off = registerCombatSounds()
    playThunder(true, { cameraShake: true, scareIntensity: 'full' }, () => {})
    off()
    expect(engine.voiceCount).toBe(1)
    // gains are created in order: sfx bus first
    expect(ctx.gainLogs[0][ctx.gainLogs[0].length - 1]).toBeCloseTo(0.4, 5)
  })

  it('still captions and decides the shake with no audio context', () => {
    const texts: string[] = []
    const stop = subscribeToType('subtitleShown', (e) => texts.push(e.text))
    const off = registerCombatSounds()
    let kicks = 0
    playThunder(true, { cameraShake: true, scareIntensity: 'full' }, () => kicks++)
    playThunder(false, { cameraShake: true, scareIntensity: 'full' }, () => kicks++)
    off()
    stop()
    expect(texts).toEqual(['[thunder]', '[thunder]'])
    expect(kicks).toBe(1)
  })
})

describe('music master while silent', () => {
  it('targets 0 on the master gain once the mixer has ducked fully', () => {
    let s = initMixer(0)
    s = stepMixer(s, { layer: 0, silent: true }, MUSIC.duckFadeS + 0.1)
    expect(s.master).toBe(0)
    const { ctx } = setup()
    stepMusic({ stems: [1, 0, 0, 0], master: s.master })
    // gains: sfx, music bus, then the music master
    expect(ctx.gainLogs[2][ctx.gainLogs[2].length - 1]).toBe(0)
  })
})
