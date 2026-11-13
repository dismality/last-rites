// Settings persistence: pure load/save with validation and clamping.
// No React / three.js / Howler imports; storage is injectable for tests.

import type { Settings } from '../types'

export const SETTINGS_STORAGE_KEY = 'last-rites-settings'

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export const SCARE_INTENSITIES = ['full', 'reduced', 'off'] as const

/** Numeric ranges from the accessibility steering doc. */
export const SETTINGS_RANGES = {
  fov: { min: 60, max: 100 },
  mouseSensitivity: { min: 0.1, max: 3.0 },
  masterVolume: { min: 0, max: 100 },
  musicVolume: { min: 0, max: 100 },
  sfxVolume: { min: 0, max: 100 },
  brightness: { min: 0.8, max: 1.4 },
} as const

type NumericKey = keyof typeof SETTINGS_RANGES
type BooleanKey =
  | 'flashingLights'
  | 'cameraShake'
  | 'headBob'
  | 'invertY'
  | 'subtitles'
  | 'accessibleHUD'
  | 'tutorialPrompts'
  | 'damageNumbers'
  | 'showMinimap'
  | 'showPinsInWorld'
  | 'showControlHints'
  | 'lowGraphics'

const BOOLEAN_KEYS: readonly BooleanKey[] = [
  'damageNumbers',
  'flashingLights',
  'cameraShake',
  'headBob',
  'invertY',
  'subtitles',
  'accessibleHUD',
  'tutorialPrompts',
  'showMinimap',
  'showPinsInWorld',
  'showControlHints',
  'lowGraphics',
]

export const DEFAULT_SETTINGS: Settings = {
  scareIntensity: 'full',
  flashingLights: true,
  cameraShake: true,
  headBob: true,
  fov: 75,
  mouseSensitivity: 1.0,
  invertY: false,
  subtitles: true,
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 80,
  brightness: 1.0,
  accessibleHUD: false,
  tutorialPrompts: true,
  damageNumbers: true,
  showMinimap: true,
  showPinsInWorld: true,
  showControlHints: true,
  lowGraphics: false,
  bindings: {
    MoveForward: 'KeyW',
    MoveBackward: 'KeyS',
    MoveLeft: 'KeyA',
    MoveRight: 'KeyD',
    Sprint: 'ShiftLeft',
    Interact: 'KeyE',
    Attack: 'MouseLeft',
    Block: 'MouseRight',
    Reload: 'KeyR',
    Kick: 'KeyQ',
    Dodge: 'KeyC',
    HeavyAttack: 'KeyV',
    Hotbar1: 'Digit1',
    Hotbar2: 'Digit2',
    Hotbar3: 'Digit3',
    Hotbar4: 'Digit4',
    Satchel: 'Tab',
    Journal: 'KeyJ',
    Lantern: 'KeyF',
    Map: 'KeyM',
    Minimap: 'KeyN',
    Pause: 'Escape',
    // Skips the intro cutscene; Enter is always accepted too.
    Skip: 'Space',
  },
}

function freshDefaults(): Settings {
  return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_SETTINGS.bindings } }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

function defaultStorage(): SettingsStorage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Defaults for a first run: reduced-motion users start with shake and bob off. */
function firstRunDefaults(): Settings {
  const s = freshDefaults()
  if (prefersReducedMotion()) {
    s.cameraShake = false
    s.headBob = false
  }
  return s
}

/** Merge untrusted parsed data over defaults, clamping/discarding invalid fields. */
function sanitize(raw: unknown, base: Settings): Settings {
  const out: Settings = { ...base, bindings: { ...base.bindings } }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  const r = raw as Record<string, unknown>

  if (typeof r.scareIntensity === 'string' && (SCARE_INTENSITIES as readonly string[]).includes(r.scareIntensity)) {
    out.scareIntensity = r.scareIntensity as Settings['scareIntensity']
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof r[key] === 'boolean') out[key] = r[key]
  }
  for (const key of Object.keys(SETTINGS_RANGES) as NumericKey[]) {
    const v = r[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = clamp(v, SETTINGS_RANGES[key].min, SETTINGS_RANGES[key].max)
    }
  }
  if (typeof r.bindings === 'object' && r.bindings !== null && !Array.isArray(r.bindings)) {
    for (const [action, code] of Object.entries(r.bindings as Record<string, unknown>)) {
      if (typeof code === 'string') out.bindings[action] = code
    }
    // Saves from before the big map bound the minimap to M. M now opens the map, so move the
    // minimap to N unless the player chose some other key for it.
    const saved = r.bindings as Record<string, unknown>
    if (saved.Minimap === 'KeyM' && saved.Map === undefined) out.bindings.Minimap = 'KeyN'
  }
  return out
}

/** Load settings; never throws. Falls back to defaults on any storage/parse failure. */
export function loadSettings(storage: SettingsStorage | undefined = defaultStorage()): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY)
    // No saved settings: first run, so honour prefers-reduced-motion.
    if (raw === null || raw === undefined) return firstRunDefaults()
    return sanitize(JSON.parse(raw), freshDefaults())
  } catch (err) {
    console.warn('Last Rites: could not load settings, using defaults.', err)
    return freshDefaults()
  }
}

/** Persist settings; never throws. */
export function saveSettings(
  settings: Settings,
  storage: SettingsStorage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.warn('Last Rites: could not save settings.', err)
  }
}
