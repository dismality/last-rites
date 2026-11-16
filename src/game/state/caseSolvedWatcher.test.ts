import { afterEach, describe, expect, it } from 'vitest'
import { CASE_1_REWARD } from '../../data/cases'
import { FIXED_SPAWNS } from '../../data/zones'
import { availableFixedSpawns, createSpawnWorld } from '../systems/spawns'
import { useCaseStore } from './caseStore'
import { usePinStore } from './pinStore'
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
  it('lies in Pell\'s grave only after the case closes, and the mound is pinned', () => {
    const key = (closed: readonly ('saved-by-the-bell')[]) =>
      availableFixedSpawns(createSpawnWorld(), 'day', FIXED_SPAWNS, closed).find((s) => s.item === 'rusted-crypt-key')
    expect(key([])).toBeUndefined()
    expect(key(['saved-by-the-bell'])?.position).toEqual([...CASE_1_REWARD.position])
    usePinStore.getState().clear()
    useCaseStore.getState().closeCase('saved-by-the-bell')
    markCase1Reward()
    const pin = usePinStore.getState().pins[0]
    expect([pin.x, pin.z]).toEqual([CASE_1_REWARD.position[0], CASE_1_REWARD.position[2]])
  })
})
