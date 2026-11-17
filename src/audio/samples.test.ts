import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { playFootstep, playRecorded, playScareSound, syncEnemyLoops, resetEnemyLoopsForTests, setLoopClockForTests, setLoopRandomForTests } from './AudioManager'
import {
  hasSample,
  loadSamples,
  resetSamplesForTests,
  setSampleBufferForTests,
  setSampleIndexForTests,
  setSampleRandomForTests,
} from './samples'
import { playSound, resetSynthForTests, setSynthForTests, type SynthEngine } from './synth'

const buffer = (tag: string) => ({ tag }) as unknown as AudioBuffer

let synthPlayed: string[]
let filePlayed: { tag: string; at?: unknown; volume: number }[]

beforeEach(() => {
  synthPlayed = []
  filePlayed = []
  setSynthForTests({
    play: (id: string) => {
      synthPlayed.push(id)
      return true
    },
    playBuffer: (b: AudioBuffer, at: unknown, volume: number) => {
      filePlayed.push({ tag: (b as unknown as { tag: string }).tag, at, volume })
      return { stop: () => {} }
    },
    ctx: { decodeAudioData: async (d: ArrayBuffer) => buffer(`decoded-${d.byteLength}`) },
  } as unknown as SynthEngine)
})

afterEach(() => {
  resetSynthForTests()
  resetSamplesForTests()
  resetEnemyLoopsForTests()
  setLoopClockForTests(null)
  setLoopRandomForTests(null)
})

describe('recorded files over synth recipes', () => {
  it('plays the synth recipe when there is no file', () => {
    playSound('melee-hit')
    expect(synthPlayed).toEqual(['melee-hit'])
    expect(filePlayed).toEqual([])
  })

  it('plays the file instead once it is decoded', () => {
    setSampleIndexForTests(['sfx/melee-hit.ogg'])
    setSampleBufferForTests('sfx/melee-hit.ogg', buffer('hit'))
    playSound('melee-hit')
    expect(filePlayed.map((p) => p.tag)).toEqual(['hit'])
    expect(synthPlayed).toEqual([])
  })

  it('falls back to the recipe while the file is still decoding', () => {
    setSampleIndexForTests(['sfx/melee-hit.ogg'])
    playSound('melee-hit')
    expect(synthPlayed).toEqual(['melee-hit'])
  })

  it('picks among -N variants', () => {
    setSampleIndexForTests(['sfx/step-grass-1.ogg', 'sfx/step-grass-2.ogg'])
    setSampleBufferForTests('sfx/step-grass-1.ogg', buffer('g1'))
    setSampleBufferForTests('sfx/step-grass-2.ogg', buffer('g2'))
    setSampleRandomForTests(() => 0.9)
    playFootstep('grass')
    setSampleRandomForTests(() => 0.1)
    playFootstep('grass')
    expect(filePlayed.map((p) => p.tag)).toEqual(['g2', 'g1'])
  })
})

describe('file-only sounds', () => {
  it('stay silent with no file, and never reach the synth', () => {
    expect(playRecorded('page-turn')).toBeNull()
    playFootstep('wood')
    playScareSound('door-slam', 1, 2, 3, 1)
    expect(filePlayed).toEqual([])
    expect(synthPlayed).toEqual([])
  })

  it('a scare at volume 0 stays silent even with a file', () => {
    setSampleIndexForTests(['sfx/door-slam.ogg'])
    setSampleBufferForTests('sfx/door-slam.ogg', buffer('slam'))
    playScareSound('door-slam', 1, 2, 3, 0)
    playScareSound('door-slam', 1, 2, 3, 0.4)
    expect(filePlayed).toEqual([{ tag: 'slam', at: { x: 1, y: 2, z: 3 }, volume: 0.4 }])
  })
})

describe('shambler groans', () => {
  const shambler = (uid: string) => ({ uid, cue: 'shambler-drag' as const, x: 0, y: 1, z: 0 })

  it('are silent without zombie-groan files', () => {
    setLoopClockForTests(() => 100)
    syncEnemyLoops([shambler('a')])
    expect(filePlayed).toEqual([])
  })

  it('wait a random part of the interval, then groan from the files', () => {
    setSampleIndexForTests(['sfx/zombie-groan-1.ogg'])
    setSampleBufferForTests('sfx/zombie-groan-1.ogg', buffer('groan'))
    setLoopRandomForTests(() => 0.5)
    let now = 0
    setLoopClockForTests(() => now)
    syncEnemyLoops([shambler('a')])
    expect(filePlayed).toEqual([])
    now = 3.3 // half of the 6.5 s interval
    syncEnemyLoops([shambler('a')])
    expect(filePlayed.map((p) => p.tag)).toEqual(['groan'])
  })
})

describe('loadSamples', () => {
  it('reads the manifest and decodes the listed files', async () => {
    const urls: string[] = []
    const fetchFn = async (url: string) => {
      urls.push(url)
      if (url.endsWith('manifest.json')) return { ok: true, json: async () => ['sfx/kick.ogg', 'music/title-theme.ogg'], arrayBuffer: async () => new ArrayBuffer(0) }
      return { ok: true, json: async () => null, arrayBuffer: async () => new ArrayBuffer(7) }
    }
    const engine = { ctx: { decodeAudioData: async (d: ArrayBuffer) => buffer(`decoded-${d.byteLength}`) } } as unknown as SynthEngine
    await loadSamples(engine, fetchFn)
    expect(hasSample('kick')).toBe(true)
    expect(hasSample('title-theme')).toBe(true)
    // Music is listed but not decoded up front.
    expect(urls.some((u) => u.endsWith('/assets/audio/sfx/kick.ogg'))).toBe(true)
    expect(urls.some((u) => u.includes('title-theme'))).toBe(false)
  })

  it('leaves every sound on its fallback when the manifest is missing', async () => {
    const fetchFn = async () => ({ ok: false, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) })
    await loadSamples({ ctx: {} } as unknown as SynthEngine, fetchFn)
    expect(hasSample('kick')).toBe(false)
  })
})
