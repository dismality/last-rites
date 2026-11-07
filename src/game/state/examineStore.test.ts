import { beforeEach, describe, expect, it } from 'vitest'
import { useExamineStore } from './examineStore'
import { useGameStore } from './gameStore'
import { useInventoryStore } from './inventoryStore'

describe('examineStore', () => {
  beforeEach(() => {
    useExamineStore.setState({ item: null, clueRevealed: false })
    useGameStore.setState({ examining: false })
  })

  it('freezes the simulation while open and files a key item in the journal on close', () => {
    const slotsBefore = useInventoryStore.getState().inventory.slots.length
    useExamineStore.getState().open('rusted-crypt-key')
    expect(useGameStore.getState().examining).toBe(true)
    useExamineStore.getState().close()
    expect(useGameStore.getState().examining).toBe(false)
    const inv = useInventoryStore.getState().inventory
    expect(inv.keyItems).toContain('rusted-crypt-key')
    expect(inv.slots.length).toBe(slotsBefore)
  })

  it('files relics separately and ignores materials', () => {
    useExamineStore.getState().open('bone')
    expect(useExamineStore.getState().item).toBeNull()
    useExamineStore.getState().open('crane-rosary')
    useExamineStore.getState().close()
    expect(useInventoryStore.getState().inventory.relics).toContain('crane-rosary')
  })
})
