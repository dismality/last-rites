import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_STORAGE_KEY, loadSettings } from '../systems/settings'

// Node has no localStorage; a real in-memory Storage-shaped object (not a mock of the code under test).
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('settingsStore tutorialPrompts', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', memoryStorage())
  })

  it('defaults to true, and toggling updates the store and persists', async () => {
    const { useSettingsStore } = await import('./settingsStore')
    expect(useSettingsStore.getState().tutorialPrompts).toBe(true)

    useSettingsStore.getState().setSetting('tutorialPrompts', false)

    expect(useSettingsStore.getState().tutorialPrompts).toBe(false)
    const raw = globalThis.localStorage.getItem(SETTINGS_STORAGE_KEY)
    expect(JSON.parse(raw ?? '{}').tutorialPrompts).toBe(false)
    expect(loadSettings().tutorialPrompts).toBe(false)

    useSettingsStore.getState().setSetting('tutorialPrompts', true)
    expect(loadSettings().tutorialPrompts).toBe(true)
  })
})
