// Spec 10 Req 5: the Dev_Panel stage actions go through the real stores.
import { beforeEach, describe, expect, it } from 'vitest'
import { STAGES } from '../data/stages'
import { useCraftingStore } from '../game/state/craftingStore'
import { useInventoryStore } from '../game/state/inventoryStore'
import { useStageStore } from '../game/state/stageStore'
import { useWorldStore } from '../game/state/worldStore'
import { skipToStage, solveCurrentCase } from './devActions'

function reset(): void {
  useWorldStore.setState({ phase: 'day', phaseTime: 0, nightNumber: 1, wavesCleared: false })
  useStageStore.getState().startStage(1)
  useCraftingStore.setState({ unlockedRecipes: [] })
}

describe('skipToStage', () => {
  beforeEach(reset)

  it.each([1, 2, 3] as const)('starts stage %i at the beginning of its day', (n) => {
    skipToStage(n)
    expect(useStageStore.getState().stage).toBe(n)
    expect(useStageStore.getState().caseSolved).toBe(false)
    const w = useWorldStore.getState()
    expect(w.nightNumber).toBe(n)
    expect(w.phase).toBe('day')
    expect(w.phaseTime).toBe(0)
  })

  it('grants the recipes of earlier stages only', () => {
    skipToStage(3)
    const have = useCraftingStore.getState().unlockedRecipes
    for (const s of STAGES.filter((x) => x.stage < 3)) s.dawnUnlocks.forEach((r) => expect(have).toContain(r))
    skipToStage(1)
    expect(useStageStore.getState().stage).toBe(1)
  })

  it('hands over the crypt key from stage 2 on, and the whistle at stage 3', () => {
    const inv = useInventoryStore.getState()
    inv.setInventory({ ...inv.inventory, keyItems: [] })
    skipToStage(2)
    const keys = () => useInventoryStore.getState().inventory.keyItems
    expect(keys()).toContain('rusted-crypt-key')
    expect(keys()).not.toContain('bone-whistle')
    skipToStage(3)
    expect(keys()).toContain('bone-whistle')
  })
})

describe('solveCurrentCase', () => {
  beforeEach(reset)

  it('sets the case solved flag once and reports a repeat', () => {
    useWorldStore.setState({ phase: 'night' })
    expect(solveCurrentCase()).toContain('Solved')
    expect(useStageStore.getState().caseSolved).toBe(true)
    expect(solveCurrentCase()).toContain('already')
  })
})
