// Spawn state: daily material respawn and once-only fixed spawns (keys, relics, pages).

import { FIXED_SPAWNS, SPAWN_POINTS, type FixedSpawn, type SpawnPoint } from '../../data/zones'
import { LOOT_TABLE_MAP } from '../../data/lootTables'
import type { ItemStack, Phase } from '../types'
import type { Rng } from '../rng'
import { rollLoot } from './loot'

export interface SpawnWorld {
  /** Material stacks currently lying at each spawn point id. */
  materials: Record<string, ItemStack[]>
  /** Fixed spawn ids already collected; they never come back. */
  collectedFixed: readonly string[]
}

export function createSpawnWorld(): SpawnWorld {
  return { materials: {}, collectedFixed: [] }
}

/**
 * Called when a new day begins: every material spawn point is refilled from its loot table.
 * Fixed spawns are untouched, so collected keys/relics/pages stay gone.
 */
export function respawnForDay(
  world: SpawnWorld,
  rng: Rng,
  points: readonly SpawnPoint[] = SPAWN_POINTS,
): SpawnWorld {
  const materials: Record<string, ItemStack[]> = {}
  // Graves hold nothing on the surface: their loot is rolled when the player digs (dig.ts).
  for (const p of points) materials[p.id] = p.lootTable === 'grave-dig' ? [] : rollLoot(LOOT_TABLE_MAP[p.lootTable], rng)
  return { ...world, materials }
}

/** Night-only spawns (the Child's Locket) are hidden at any other phase. */
export function isFixedSpawnVisible(spawn: FixedSpawn, phase: Phase): boolean {
  return !spawn.nightOnly || phase === 'night'
}

/** Fixed spawns the player can see and collect right now. */
export function availableFixedSpawns(
  world: SpawnWorld,
  phase: Phase,
  spawns: readonly FixedSpawn[] = FIXED_SPAWNS,
): FixedSpawn[] {
  return spawns.filter(
    (s) => !world.collectedFixed.includes(s.id) && isFixedSpawnVisible(s, phase),
  )
}

/** Marks a fixed spawn collected. Returns the same world if refused (hidden, unknown or taken). */
export function collectFixedSpawn(
  world: SpawnWorld,
  id: string,
  phase: Phase,
  spawns: readonly FixedSpawn[] = FIXED_SPAWNS,
): SpawnWorld {
  const spawn = spawns.find((s) => s.id === id)
  if (!spawn || world.collectedFixed.includes(id) || !isFixedSpawnVisible(spawn, phase)) return world
  return { ...world, collectedFixed: [...world.collectedFixed, id] }
}

/** Removes a picked-up material stack from its spawn point. */
export function takeMaterial(world: SpawnWorld, spawnId: string, index: number): SpawnWorld {
  const stacks = world.materials[spawnId]
  if (!stacks || index < 0 || index >= stacks.length) return world
  return {
    ...world,
    materials: { ...world.materials, [spawnId]: stacks.filter((_, i) => i !== index) },
  }
}
