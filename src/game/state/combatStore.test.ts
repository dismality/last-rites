import { beforeEach, describe, expect, it } from 'vitest'
import { maxDurability } from '../systems/durability'
import type { Inventory } from '../types'
import { captureCombatSave, COMBAT_PERSISTED } from './combatPersistence'
import { initialLive, useCombatStore } from './combatStore'
import { useCraftingStore } from './craftingStore'
import { useInventoryStore } from './inventoryStore'

const inv = (...items: string[]): Inventory => ({
  slots: items.map((item) => ({ item, qty: 1 })) as Inventory['slots'],
  keyItems: [],
  relics: [],
  hotbar: [null, null, null, null],
})

beforeEach(() => {
  useCombatStore.setState({
    firearms: {},
    durability: {},
    upgrades: [],
    takenPickups: [],
    live: initialLive(),
  })
})

describe('combatStore.reconcile', () => {
  it('creates state the first time a weapon is held', () => {
    useCombatStore.getState().reconcile(inv('revolver', 'bone-club'), null)
    const s = useCombatStore.getState()
    expect(s.firearms.revolver).toEqual({ magazine: 6 })
    expect(s.durability['bone-club']).toBe(maxDurability('bone-club'))
  })

  it('keeps existing state and leaves it alone while the item is on the ground', () => {
    useCombatStore.getState().reconcile(inv('shotgun'), null)
    useCombatStore.getState().setMagazine('shotgun', 1)
    useCombatStore.getState().reconcile(inv(), null)
    expect(useCombatStore.getState().firearms.shotgun).toEqual({ magazine: 1 })
    useCombatStore.getState().reconcile(inv('shotgun'), null)
    expect(useCombatStore.getState().firearms.shotgun).toEqual({ magazine: 1 })
  })

  it('deletes durability when the weapon breaks', () => {
    useCombatStore.setState({ durability: { 'bone-club': 2 } })
    expect(useCombatStore.getState().spendDurability('bone-club')).toBe(false)
    expect(useCombatStore.getState().durability['bone-club']).toBe(1)
    expect(useCombatStore.getState().spendDurability('bone-club')).toBe(true)
    expect(useCombatStore.getState().durability['bone-club']).toBeUndefined()
  })

  it('cancels reload, charge and use when the held item changes', () => {
    const s = useCombatStore.getState()
    s.reconcile(inv('revolver'), 'revolver')
    s.patchLive({
      reload: { weapon: 'revolver', leftS: 1, totalS: 2.4 },
      charge: { heldS: 0.3, auto: false },
    })
    useCombatStore.getState().reconcile(inv('revolver'), 'revolver')
    expect(useCombatStore.getState().live.reload).not.toBeNull()
    useCombatStore.getState().reconcile(inv('revolver'), 'rusty-shovel')
    const live = useCombatStore.getState().live
    expect(live.reload).toBeNull()
    expect(live.charge).toBeNull()
    expect(live.heldId).toBe('rusty-shovel')
  })
})

describe('combatStore actions and persistence', () => {
  it('takePickup moves the weapon into the satchel and records the pickup', () => {
    useInventoryStore.setState({ inventory: inv('rusty-shovel') })
    useCraftingStore.setState({ unlockedRecipes: [] })
    const res = useCombatStore.getState().takePickup('revolver')
    expect(res.ok).toBe(true)
    const s = useCombatStore.getState()
    expect(s.takenPickups).toEqual(['revolver'])
    expect(s.firearms.revolver).toEqual({ magazine: 6 })
    expect(useCraftingStore.getState().unlockedRecipes).toContain('r-revolver-cartridge')
    expect(useCombatStore.getState().takePickup('revolver').ok).toBe(false)
  })

  it('captureCombatSave covers every persisted field and ignores live state', () => {
    useCombatStore.setState({ upgrades: [], takenPickups: ['wood-axe'] })
    const save = captureCombatSave()
    for (const k of COMBAT_PERSISTED.combat) expect(save).toHaveProperty(k)
    expect(save.takenPickups).toEqual(['wood-axe'])
    expect(save).not.toHaveProperty('live')
    expect(save.doors.built).toBe(false)
  })
})
