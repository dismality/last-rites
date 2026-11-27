import { afterEach, describe, expect, it } from 'vitest'
import { CASE_1_REWARD } from '../../data/cases'
import { FIXED_SPAWNS } from '../../data/zones'
import { availableFixedSpawns, createSpawnWorld } from '../systems/spawns'
import { useCaseStore } from './caseStore'
import { useInventoryStore } from './inventoryStore'
import { useSpawnStore } from './spawnStore'
import { markCase1Reward } from './caseSolvedWatcher'
import { installCaseSolvedWatcher } from './caseSolvedWatcher'
import { useChapelStore } from './chapelStore'
import { emit } from '../events'

describe('caseSolvedWatcher: daily chapel reset', () => {
  let off: (() => void) | null = null
  afterEach(() => off?.())

  it('clears the altar heal flag at dawn so the altar heals again each day', () => {
    off = installCaseSolvedWatcher()
    useChapelStore.getState().setAltarHealedToday(true)
    emit({ type: 'dawnStarted', nightNumber: 1 })
    expect(useChapelStore.getState().chapel.altarHealedToday).toBe(false)
  })
})

describe('case 1 reward (Req 14.4)', () => {
  it('the altar hands over the key, and it never lies in Pell\'s grave as well', () => {
    useSpawnStore.getState().setWorld(createSpawnWorld())
    useInventoryStore.getState().setInventory({ ...useInventoryStore.getState().inventory, keyItems: [] })
    useCaseStore.getState().closeCase('saved-by-the-bell')
    markCase1Reward()
    expect(useInventoryStore.getState().inventory.keyItems).toContain(CASE_1_REWARD.item)
    const lying = availableFixedSpawns(useSpawnStore.getState().world, 'day', FIXED_SPAWNS, ['saved-by-the-bell'])
    expect(lying.find((s) => s.item === CASE_1_REWARD.item)).toBeUndefined()
  })
})
