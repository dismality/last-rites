import { afterEach, describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import type { Settings } from '../types'
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  saveSettings,
  type SettingsStorage,
} from './settings'

function memoryStorage(initial?: string): SettingsStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(SETTINGS_STORAGE_KEY, initial)
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

const settingsArb: fc.Arbitrary<Settings> = fc.record({
  scareIntensity: fc.constantFrom('full', 'reduced', 'off'),
  flashingLights: fc.boolean(),
  cameraShake: fc.boolean(),
  headBob: fc.boolean(),
  fov: fc.double({ min: 60, max: 100, noNaN: true }),
  mouseSensitivity: fc.double({ min: 0.1, max: 3.0, noNaN: true }),
  invertY: fc.boolean(),
  subtitles: fc.boolean(),
  masterVolume: fc.double({ min: 0, max: 100, noNaN: true }),
  musicVolume: fc.double({ min: 0, max: 100, noNaN: true }),
  sfxVolume: fc.double({ min: 0, max: 100, noNaN: true }),
  brightness: fc.double({ min: 0.8, max: 1.4, noNaN: true }),
  accessibleHUD: fc.boolean(),
  bindings: fc.constant({ ...DEFAULT_SETTINGS.bindings }),
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('settings persistence', () => {
  it('returns the documented defaults when nothing is saved', () => {
    const s = loadSettings(memoryStorage())
    expect(s).toEqual(DEFAULT_SETTINGS)
    expect(s.fov).toBe(75)
    expect(s.masterVolume).toBe(80)
    expect(s.musicVolume).toBe(60)
    expect(s.sfxVolume).toBe(80)
  })

  it('round-trips any valid Settings (property)', () => {
    // **Validates: Requirements 6.1, 6.2**
    fc.assert(
      fc.property(settingsArb, (s) => {
        const storage = memoryStorage()
        saveSettings(s, storage)
        expect(loadSettings(storage)).toEqual(s)
      }),
    )
  })

  it('clamps out-of-range values and ignores invalid types', () => {
    const storage = memoryStorage(
      JSON.stringify({ fov: 500, mouseSensitivity: -4, brightness: 9, masterVolume: -1, sfxVolume: 'loud', scareIntensity: 'max', headBob: 'yes' }),
    )
    const s = loadSettings(storage)
    expect(s.fov).toBe(100)
    expect(s.mouseSensitivity).toBe(0.1)
    expect(s.brightness).toBe(1.4)
    expect(s.masterVolume).toBe(0)
    expect(s.sfxVolume).toBe(80)
    expect(s.scareIntensity).toBe('full')
    expect(s.headBob).toBe(true)
  })

  it('returns defaults for corrupt JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(loadSettings(memoryStorage('{not json'))).toEqual(DEFAULT_SETTINGS)
  })

  it('returns defaults and warns when storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(() => loadSettings(broken)).not.toThrow()
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('disables shake and head bob on first load when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const s = loadSettings(memoryStorage())
    expect(s.cameraShake).toBe(false)
    expect(s.headBob).toBe(false)
  })

  it('does not override saved choices with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, cameraShake: true, headBob: true }, storage)
    const s = loadSettings(storage)
    expect(s.cameraShake).toBe(true)
    expect(s.headBob).toBe(true)
  })
})
