import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'
import { useMysteryStore } from './mysteryStore'
import { useTombstoneStore } from './tombstoneStore'

describe('tombstoneStore', () => {
  beforeEach(() => {
    useTombstoneStore.setState({ id: null, wrongGrave: false })
    useGameStore.setState({ examining: false })
    useMysteryStore.getState().reset()
    useInventoryStore.setState((s) => ({ inventory: { ...s.inventory, keyItems: [] } }))
  })

  it('opens, freezes the sim, records the stone clue, and closes', () => {
    useTombstoneStore.getState().open('marsh')
    expect(useGameStore.getState().examining).toBe(true)
    expect(useTombstoneStore.getState().wrongGrave).toBe(false)
    expect(useMysteryStore.getState().mystery.clues.has('clue-marsh-stone')).toBe(true)
    useTombstoneStore.getState().close()
    expect(useGameStore.getState().examining).toBe(false)
  })

  it('flags a wrong grave when the ledger is held', () => {
    useInventoryStore.getState().addKeyItem('parish-ledger')
    useTombstoneStore.getState().open('hale')
    expect(useTombstoneStore.getState().wrongGrave).toBe(true)
    expect(useMysteryStore.getState().mystery.clues.has('clue-wrong-grave-hale')).toBe(true)
  })
})
