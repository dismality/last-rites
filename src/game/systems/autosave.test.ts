import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMysteryState } from './mystery'
import { AUTOSAVE_KEY, SAVE_KEY, hasValidSave, readLatestSave, writeSave } from './saveGame'
import type { SaveState } from './saveGame'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

function state(nightNumber: number): SaveState {
  return {
    world: { phase: 'day', phaseTime: 0, nightNumber, fogDensity: 0.02, wavesCleared: false },
    player: { position: [0, 0, 0], yaw: 0, pitch: 0, health: 100, stamina: 100, interactTarget: null },
    inventory: { slots: [], keyItems: [], relics: [], hotbar: [null, null, null, null] },
    mystery: createMysteryState(),
    chapel: { completedStages: [], altarHealedToday: false, finalRiteActive: false },
    recipes: [],
  } as unknown as SaveState
}

describe('autosave slot', () => {
  it('writes beside the altar save, never over it', () => {
    const s = memoryStorage()
    writeSave(s, state(1), SAVE_KEY, 10)
    writeSave(s, state(2), AUTOSAVE_KEY, 20)
    expect(JSON.parse(s.getItem(SAVE_KEY)!).world.nightNumber).toBe(1)
    expect(JSON.parse(s.getItem(AUTOSAVE_KEY)!).world.nightNumber).toBe(2)
  })

  it('offers Continue for an autosave alone', () => {
    const s = memoryStorage()
    expect(hasValidSave(s)).toBe(false)
    writeSave(s, state(1), AUTOSAVE_KEY)
    expect(hasValidSave(s)).toBe(true)
  })

  it('ignores a corrupt autosave and falls back to the altar save', () => {
    const s = memoryStorage()
    writeSave(s, state(1), SAVE_KEY, 10)
    s.setItem(AUTOSAVE_KEY, '{nope')
    expect(readLatestSave(s)?.world.nightNumber).toBe(1)
  })

  // Validates: Requirements 12.8 (Continue loads the newest save)
  it('property: Continue loads the newer slot, the altar save on a tie', () => {
    fc.assert(
      fc.property(fc.nat(1000), fc.nat(1000), (manualAt, autoAt) => {
        const s = memoryStorage()
        writeSave(s, state(1), SAVE_KEY, manualAt)
        writeSave(s, state(2), AUTOSAVE_KEY, autoAt)
        expect(readLatestSave(s)?.world.nightNumber).toBe(autoAt > manualAt ? 2 : 1)
      }),
    )
  })
})
