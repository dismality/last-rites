import { beforeEach, describe, expect, it } from 'vitest'
import { useCombatStore } from './combatStore'
import { useCraftingStore } from './craftingStore'
import { useDoorStore } from './doorStore'
import { useInventoryStore } from './inventoryStore'
import { CUSTOM_RESETS, KEPT_STORES, REPLACED_STORES, resetRun } from './resetRun'
import { getRegenDelay, writeRegenDelay } from './staminaRuntime'

// Every module under src/game/state; any zustand store exported from one must be accounted for.
const modules = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true }) as Record<string, Record<string, unknown>>

const isStore = (v: unknown): boolean =>
  typeof v === 'function' &&
  typeof (v as { getInitialState?: unknown }).getInitialState === 'function' &&
  typeof (v as { setState?: unknown }).setState === 'function'

describe('resetRun registry', () => {
  it('accounts for every zustand store under src/game/state', () => {
    const known = new Set<unknown>([
      ...REPLACED_STORES,
      ...CUSTOM_RESETS.map(([s]) => s),
      ...KEPT_STORES.map(([s]) => s),
    ])
    const missing: string[] = []
    for (const [file, mod] of Object.entries(modules)) {
      if (file.endsWith('.test.ts')) continue
      for (const [name, value] of Object.entries(mod)) {
        if (isStore(value) && !known.has(value)) missing.push(`${file}:${name}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('gives every kept store a reason', () => {
    for (const [, reason] of KEPT_STORES) expect(reason.length).toBeGreaterThan(5)
  })
})

describe('resetRun (New Game after a played run)', () => {
  beforeEach(() => resetRun())

  it('brings back weapon pickups, upgrades, durability, magazines and doors', () => {
    useInventoryStore.setState({ inventory: useInventoryStore.getState().inventory })
    expect(useCombatStore.getState().takePickup('revolver').ok).toBe(true)
    expect(useCombatStore.getState().takePickup('wood-axe').ok).toBe(true)
    useCombatStore.getState().setMagazine('revolver', 1)
    useCombatStore.getState().spendDurability('wood-axe')
    useDoorStore.getState().build()
    useDoorStore.getState().setDoors({ front: [10], vestry: [] })
    writeRegenDelay(5)

    resetRun()

    const c = useCombatStore.getState()
    expect(c.takenPickups).toEqual([])
    expect(c.upgrades).toEqual([])
    expect(c.firearms).toEqual({})
    expect(c.durability).toEqual({})
    expect(useDoorStore.getState()).toMatchObject({ built: false, doors: { front: [], vestry: [] } })
    expect(useCraftingStore.getState().unlockedRecipes).not.toContain('r-revolver-cartridge')
    expect(getRegenDelay()).toBe(0)
    // The pickups can be taken again.
    expect(useCombatStore.getState().takePickup('revolver').ok).toBe(true)
    expect(useCombatStore.getState().takePickup('wood-axe').ok).toBe(true)
  })
})
