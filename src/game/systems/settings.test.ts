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
  tutorialPrompts: fc.boolean(),
  damageNumbers: fc.boolean(),
  showMinimap: fc.boolean(),
  showPinsInWorld: fc.boolean(),
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

  it('defaults tutorialPrompts to true and Skip to Space', () => {
    expect(DEFAULT_SETTINGS.tutorialPrompts).toBe(true)
    expect(DEFAULT_SETTINGS.bindings.Skip).toBe('Space')
  })

  it('round-trips tutorialPrompts false', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, tutorialPrompts: false }, storage)
    expect(loadSettings(storage).tutorialPrompts).toBe(false)
  })

  it('loads settings stored before this change with the new defaults', () => {
    const { tutorialPrompts: _t, ...rest } = DEFAULT_SETTINGS
    const { Skip: _s, ...oldBindings } = DEFAULT_SETTINGS.bindings
    void _t
    void _s
    const storage = memoryStorage(JSON.stringify({ ...rest, fov: 90, bindings: oldBindings }))
    const s = loadSettings(storage)
    expect(s.tutorialPrompts).toBe(true)
    expect(s.bindings.Skip).toBe('Space')
    expect(s.fov).toBe(90)
  })

  it('defaults damageNumbers on and the combat bindings', () => {
    expect(DEFAULT_SETTINGS.damageNumbers).toBe(true)
    expect(DEFAULT_SETTINGS.bindings).toMatchObject({
      Reload: 'KeyR',
      Kick: 'KeyQ',
      Dodge: 'KeyC',
      HeavyAttack: 'KeyV',
      Block: 'MouseRight',
    })
  })

  it('defaults Show minimap on, Map to M and Minimap to N without clashing with another action', () => {
    expect(DEFAULT_SETTINGS.showMinimap).toBe(true)
    expect(DEFAULT_SETTINGS.showPinsInWorld).toBe(true)
    expect(DEFAULT_SETTINGS.bindings.Map).toBe('KeyM')
    expect(DEFAULT_SETTINGS.bindings.Minimap).toBe('KeyN')
    const codes = Object.values(DEFAULT_SETTINGS.bindings)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('round-trips showMinimap false and loads old saves with the map on and M bound', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, showMinimap: false }, storage)
    expect(loadSettings(storage).showMinimap).toBe(false)
    const { Minimap: _m, ...oldBindings } = DEFAULT_SETTINGS.bindings
    void _m
    const old = loadSettings(memoryStorage(JSON.stringify({ fov: 80, bindings: oldBindings })))
    expect(old.showMinimap).toBe(true)
    expect(old.bindings.Minimap).toBe('KeyN')
  })

  it('moves a saved Minimap = M binding to N, but keeps another key the player chose', () => {
    const { Map: _map, ...rest } = DEFAULT_SETTINGS.bindings
    void _map
    const moved = loadSettings(memoryStorage(JSON.stringify({ bindings: { ...rest, Minimap: 'KeyM' } })))
    expect(moved.bindings.Minimap).toBe('KeyN')
    expect(moved.bindings.Map).toBe('KeyM')
    const kept = loadSettings(memoryStorage(JSON.stringify({ bindings: { ...rest, Minimap: 'KeyB' } })))
    expect(kept.bindings.Minimap).toBe('KeyB')
  })

  it('round-trips damageNumbers false', () => {
    const storage = memoryStorage()
    saveSettings({ ...DEFAULT_SETTINGS, damageNumbers: false }, storage)
    expect(loadSettings(storage).damageNumbers).toBe(false)
  })

  it('turns a missing or invalid damageNumbers into On', () => {
    expect(loadSettings(memoryStorage(JSON.stringify({ fov: 80 }))).damageNumbers).toBe(true)
    expect(loadSettings(memoryStorage(JSON.stringify({ damageNumbers: 'no' }))).damageNumbers).toBe(true)
    expect(loadSettings(memoryStorage(JSON.stringify({ damageNumbers: 0 }))).damageNumbers).toBe(true)
  })

  it('gives old stored bindings the four combat keys', () => {
    const old = {
      MoveForward: 'KeyW',
      Block: 'MouseRight',
      Interact: 'KeyG',
    }
    const s = loadSettings(memoryStorage(JSON.stringify({ bindings: old })))
    expect(s.bindings.Reload).toBe('KeyR')
    expect(s.bindings.Kick).toBe('KeyQ')
    expect(s.bindings.Dodge).toBe('KeyC')
    expect(s.bindings.HeavyAttack).toBe('KeyV')
    expect(s.bindings.Interact).toBe('KeyG')
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
