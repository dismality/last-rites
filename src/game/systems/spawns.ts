// Spawn state: daily material respawn and once-only fixed spawns (keys, relics, pages).

import { FIXED_SPAWNS, SPAWN_POINTS, type FixedSpawn, type SpawnPoint } from '../../data/zones'
import { LOOT_TABLE_MAP } from '../../data/lootTables'
import type { ItemStack, Phase } from '../types'
import type { Rng } from '../rng'
import { DAY1_HUT_MIN_CLOTH, DAY1_HUT_MIN_OIL } from '../../data/balance'
import { ensureMinimum, rollLoot } from './loot'

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
  // Loot already on a dug grave is kept, so a new day never wipes what the player left behind.
  for (const p of points) {
    materials[p.id] =
      p.lootTable === 'grave-dig' ? (world.materials[p.id] ?? []) : rollLoot(LOOT_TABLE_MAP[p.lootTable], rng)
  }
  return { ...world, materials }
}

/** The hut shelf, where day 1's guaranteed cloth lies. */
export const HUT_SHELF_ID = 'hut-shelf'

/**
 * Day 1's world: the normal roll, plus at least DAY1_HUT_MIN_CLOTH cloth on the hut shelf, so
 * a Bone Club can be made before night 1 (spec 09, F1). Later days roll normally.
 */
export function dayOneSpawns(rng: Rng): SpawnWorld {
  const world = respawnForDay(createSpawnWorld(), rng)
  const shelf = world.materials[HUT_SHELF_ID] ?? []
  // The oil comes first so the tutorial's "pick up the oil" (step 2) always has a target (B4).
  const withOil = ensureMinimum(shelf, 'lamp-oil', DAY1_HUT_MIN_OIL)
  return {
    ...world,
    materials: {
      ...world.materials,
      [HUT_SHELF_ID]: ensureMinimum(withOil, 'cloth', DAY1_HUT_MIN_CLOTH),
    },
  }
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
