import { beforeEach, describe, expect, it } from 'vitest'
import { emit } from '../src/game/events'
import { installSpawnRespawn } from '../src/game/state/spawnRespawn'
import { useSpawnStore } from '../src/game/state/spawnStore'
import { useWorldStore } from '../src/game/state/worldStore'
import { createRng } from '../src/game/rng'
import { createSpawnWorld, respawnForDay, takeMaterial } from '../src/game/systems/spawns'
import { SPAWN_POINTS } from '../src/data/zones'

const GRAVE = SPAWN_POINTS.find((p) => p.lootTable === 'grave-dig')!.id
const totalStacks = (): number =>
  Object.values(useSpawnStore.getState().world.materials).reduce((n, s) => n + s.length, 0)

describe('daily material respawn', () => {
  let off: () => void
  beforeEach(() => {
    off?.()
    useSpawnStore.setState({ world: respawnForDay(createSpawnWorld(), createRng(5)) })
    useWorldStore.setState({ phase: 'day', nightNumber: 1 })
    off = installSpawnRespawn()
  })

  it('returns materials taken on day 1 when day 2 starts', () => {
    const s = useSpawnStore.getState()
    s.setWorld(takeMaterial(s.world, 'hut-shelf', 0))
    const before = useSpawnStore.getState().world.materials['hut-shelf'].length
    emit({ type: 'phaseChanged', phase: 'day' })
    expect(useSpawnStore.getState().world.materials['hut-shelf'].length).toBeGreaterThan(before)
  })

  it('keeps uncollected loot on dug graves', () => {
    const loot = [{ item: 'bone' as const, qty: 2 }]
    const s = useSpawnStore.getState()
    s.setWorld({ ...s.world, materials: { ...s.world.materials, [GRAVE]: loot } })
    emit({ type: 'phaseChanged', phase: 'day' })
    expect(useSpawnStore.getState().world.materials[GRAVE]).toEqual(loot)
  })

  it('does not duplicate on a repeat day change for the same night', () => {
    emit({ type: 'phaseChanged', phase: 'day' })
    const first = totalStacks()
    const snapshot = JSON.stringify(useSpawnStore.getState().world.materials)
    emit({ type: 'phaseChanged', phase: 'day' })
    expect(totalStacks()).toBe(first)
    expect(JSON.stringify(useSpawnStore.getState().world.materials)).toBe(snapshot)
  })

  it('ignores other phases', () => {
    const s = useSpawnStore.getState()
    s.setWorld(takeMaterial(s.world, 'hut-shelf', 0))
    const w = useSpawnStore.getState().world
    emit({ type: 'phaseChanged', phase: 'dusk' })
    expect(useSpawnStore.getState().world).toBe(w)
  })
})
