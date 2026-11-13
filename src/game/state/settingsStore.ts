// Settings store — all accessibility and comfort settings, persisted to localStorage.
// Pure zustand, no React / three.js imports.

import { create } from 'zustand'
import type { Settings } from '../types'
import { loadSettings, saveSettings } from '../systems/settings'

function loadFromStorage(): Settings {
  return loadSettings()
}

function saveToStorage(s: Settings): void {
  saveSettings(s)
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
    tutorialPrompts: current.tutorialPrompts,
    damageNumbers: current.damageNumbers,
    showMinimap: current.showMinimap,
    showPinsInWorld: current.showPinsInWorld,
    showControlHints: current.showControlHints,
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
