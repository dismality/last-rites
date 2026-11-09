import { beforeEach, describe, expect, it } from 'vitest'
import { PLAYER_MAX_HEALTH } from '../../data/balance'
import { useChapelStore } from './chapelStore'
import { installCombatWatchers } from './combatWatchers'
import { useCombatStore } from './combatStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { usePlayerStore } from './playerStore'
import { createInventory } from '../systems/inventory'
import { hurtPlayer } from './retryNight'

beforeEach(() => {
  usePlayerStore.getState().setHealth(PLAYER_MAX_HEALTH)
  useGameStore.getState().setTaken(false)
  useCombatStore.getState().resetLive()
  useEffectStore.getState().clear()
  useDoorStore.getState().reset()
})

const dodgeAt = (elapsedS: number) =>
  useCombatStore.getState().patchLive({ dodge: { elapsedS, dir: { x: 1, z: 0 } } })

describe('hurtPlayer', () => {
  it('ignores zombie blows, the burst and the Toll in the first 0.2 s of a dodge', () => {
    dodgeAt(0.1)
    for (const src of ['zombie', 'burst', 'toll'] as const) {
      expect(hurtPlayer(25, false, src)).toBe(false)
    }
    expect(usePlayerStore.getState().health).toBe(PLAYER_MAX_HEALTH)
  })

  it('hurts again once the invulnerable window ends', () => {
    dodgeAt(0.22)
    expect(hurtPlayer(10, false, 'zombie')).toBe(true)
    expect(usePlayerStore.getState().health).toBeLessThan(PLAYER_MAX_HEALTH)
  })

  it('lets blocked damage through the block rule and still returns true', () => {
    expect(hurtPlayer(20, true)).toBe(true)
    const lost = PLAYER_MAX_HEALTH - usePlayerStore.getState().health
    expect(lost).toBeGreaterThan(0)
    expect(lost).toBeLessThan(20)
  })

  it('returns false once the player is taken', () => {
    useGameStore.getState().setTaken(true)
    expect(hurtPlayer(10, false)).toBe(false)
  })

  it('a Brute blow cancels a reload; a zombie blow does not', () => {
    const reload = { weapon: 'revolver' as const, leftS: 1, totalS: 2.4 }
    useCombatStore.getState().patchLive({ reload })
    hurtPlayer(10, false, 'zombie')
    expect(useCombatStore.getState().live.reload).not.toBeNull()
    hurtPlayer(10, false, 'brute')
    expect(useCombatStore.getState().live.reload).toBeNull()
  })

  it('clears timed effects when the hit kills', () => {
    useEffectStore.getState().setEffects([{ id: 'adrenaline', leftS: 10 }] as never)
    hurtPlayer(10_000, false)
    expect(useGameStore.getState().taken).toBe(true)
    expect(useEffectStore.getState().effects).toEqual([])
  })
})

describe('installCombatWatchers', () => {
  it('cancels nailing and consumable use when the player is hit', () => {
    const off = installCombatWatchers()
    useDoorStore.getState().setNail({ door: 'front', heldS: 1 } as never)
    useCombatStore.getState().patchLive({ use: { itemId: 'bandage', leftS: 1 } as never })
    hurtPlayer(5, false)
    expect(useDoorStore.getState().nail).toBeNull()
    expect(useCombatStore.getState().live.use).toBeNull()
    off()
  })
})

describe('chapelStore.applyRepair', () => {
  it('fits the barricades when stage 1 completes', () => {
    useInventoryStore.getState().setInventory({
      ...createInventory(),
      slots: [
        { item: 'iron-nail', qty: 4 },
        { item: 'bone', qty: 2 },
      ],
    })
    useChapelStore.setState({
      chapel: { completedStages: [], altarHealedToday: false, finalRiteActive: false },
    })
    const res = useChapelStore.getState().applyRepair()
    if (res.ok) {
      expect(useDoorStore.getState().built).toBe(true)
      expect(useDoorStore.getState().doors.front).toHaveLength(2)
    }
    expect(res.ok).toBe(true)
  })
})
