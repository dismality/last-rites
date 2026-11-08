// Journal pages must exist in the world and reading page 3 must teach the Salt Circle.
import { beforeEach, describe, expect, it } from 'vitest'
import { FIXED_SPAWNS } from '../src/data/zones'
import { availableFixedSpawns, createSpawnWorld } from '../src/game/systems/spawns'
import { useCraftingStore } from '../src/game/state/craftingStore'
import { useExamineStore } from '../src/game/state/examineStore'
import { useGameStore } from '../src/game/state/gameStore'
import { useSpawnStore } from '../src/game/state/spawnStore'
import { useWorldStore } from '../src/game/state/worldStore'

beforeEach(() => {
  useExamineStore.setState({ item: null, clueRevealed: false })
  useGameStore.setState({ examining: false })
  useCraftingStore.setState({ unlockedRecipes: [] })
  useSpawnStore.setState({ world: createSpawnWorld() })
})

describe('journal pages in the world', () => {
  it('all five pages are available fixed spawns (none filtered out for lacking a model)', () => {
    const items = availableFixedSpawns(createSpawnWorld(), 'day').map((s) => s.item)
    for (let n = 1; n <= 5; n++) expect(items).toContain(`journal-page-${n}`)
    expect(FIXED_SPAWNS.filter((s) => s.item.startsWith('journal-page-'))).toHaveLength(5)
  })

  it('taking page 3 and closing examine unlocks r-salt-circle', () => {
    expect(useCraftingStore.getState().unlockedRecipes).not.toContain('r-salt-circle')
    useWorldStore.setState({ phase: 'day' })
    useSpawnStore.getState().collectFixed('fx-page-3')
    expect(useExamineStore.getState().item).toBe('journal-page-3')
    // Reading is closing the examine view.
    useExamineStore.getState().close()
    expect(useCraftingStore.getState().unlockedRecipes).toContain('r-salt-circle')
    expect(useSpawnStore.getState().world.collectedFixed).toContain('fx-page-3')
  })
})
