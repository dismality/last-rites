// Settings store — all accessibility and comfort settings, persisted to localStorage.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { Settings } from '../types'

const DEFAULT_SETTINGS: Settings = {
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
  bindings: {
    MoveForward: 'KeyW',
    MoveBackward: 'KeyS',
    MoveLeft: 'KeyA',
    MoveRight: 'KeyD',
    Sprint: 'ShiftLeft',
    Interact: 'KeyE',
    Attack: 'MouseLeft',
    Block: 'MouseRight',
    Hotbar1: 'Digit1',
    Hotbar2: 'Digit2',
    Hotbar3: 'Digit3',
    Hotbar4: 'Digit4',
    Satchel: 'Tab',
    Journal: 'KeyJ',
    Lantern: 'KeyF',
    Pause: 'Escape',
  },
}

const STORAGE_KEY = 'last-rites-settings'

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveToStorage(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // storage unavailable — ignore
  }
}

/** Extract only the plain Settings fields from the full store state. */
function extractSettings(current: SettingsStoreState): Settings {
  return {
    scareIntensity: current.scareIntensity,
    flashingLights: current.flashingLights,
    cameraShake: current.cameraShake,
    headBob: current.headBob,
    fov: current.fov,
    mouseSensitivity: current.mouseSensitivity,
    invertY: current.invertY,
    subtitles: current.subtitles,
    masterVolume: current.masterVolume,
    musicVolume: current.musicVolume,
    sfxVolume: current.sfxVolume,
    brightness: current.brightness,
    accessibleHUD: current.accessibleHUD,
    bindings: current.bindings,
  }
}

interface SettingsStoreState extends Settings {
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  applySettings: (settings: Partial<Settings>) => void
  setBinding: (action: string, code: string) => void
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...loadFromStorage(),

  setSetting: (key, value) => {
    set({ [key]: value } as Pick<SettingsStoreState, typeof key>)
    saveToStorage(extractSettings(get()))
  },

  applySettings: (settings) => {
    set(settings as Partial<SettingsStoreState>)
    saveToStorage(extractSettings(get()))
  },

  setBinding: (action, code) => {
    set((state) => ({ bindings: { ...state.bindings, [action]: code } }))
    saveToStorage(extractSettings(get()))
  },
}))
