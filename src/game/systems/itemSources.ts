// Where an item can be found (design bible §5 "Where to look"). Pure TS: works only from data
// (loot tables, spawn points, fixed spawns, the merchant's stock, the elite drops), so the recipe
// book can tell the player where a missing ingredient comes from without naming it.

import { ELITE_DROPS } from '../../data/elites'
import { MERCHANT_ROWS } from '../../data/merchant'
import { LOOT_TABLE_MAP, type LootTableId } from '../../data/lootTables'
import { FIXED_SPAWNS, SPAWN_POINTS, ZONES } from '../../data/zones'
import type { ItemId, ItemStack, Phase } from '../types'

export interface SourcePoint {
  /** The spawn point or fixed spawn id. */
  id: string
  x: number
  z: number
  fixed: boolean
}

export interface ItemSource {
  /** Plain words that read after "found": "dug from grave mounds". */
  label: string
  /** Where it lies; empty for the merchant and elite drops, which have no fixed place. */
  points: SourcePoint[]
}

/** Each loot table's place in plain words, said the way the player sees it. */
const TABLE_LABEL: Readonly<Record<LootTableId, string>> = {
  'grave-dig': 'dug from grave mounds',
  'broken-coffin': 'found in coffins',
  'hut-supplies': 'on the hut shelf',
  'crypt-shelves': 'on crypt shelves',
  'chapel-font': 'at the chapel font',
  'catacomb-walls': 'in the catacomb walls',
  woodpile: 'at the woodpile',
  'path-oil': 'by the oak path',
  'powder-tin': 'in the powder tin',
}

/** Loot tables that actually have a spawn point in the world; the rest are data only so far. */
const PLACED_TABLES: ReadonlySet<LootTableId> = new Set(SPAWN_POINTS.map((p) => p.lootTable))

export const MERCHANT_LABEL = 'sold by Silas at dawn'
export const ELITE_LABEL = 'dropped by elite zombies'
/** Items the keeper starts with: nothing to look for. */
const STARTING_ITEMS: ReadonlySet<ItemId> = new Set<ItemId>(['rusty-shovel'])
export const START_LABEL = 'in your satchel from the start'

/** Every source of the item, in a stable order: world places first, then the merchant, then elites. */
export function itemSources(item: ItemId): ItemSource[] {
  const out: ItemSource[] = []
  const byLabel = new Map<string, ItemSource>()
  const add = (label: string, point?: SourcePoint) => {
    let s = byLabel.get(label)
    if (!s) {
      s = { label, points: [] }
      byLabel.set(label, s)
      out.push(s)
    }
    if (point) s.points.push(point)
  }

  for (const p of SPAWN_POINTS) {
    if (!PLACED_TABLES.has(p.lootTable)) continue
    if (!LOOT_TABLE_MAP[p.lootTable].entries.some((e) => e.item === item)) continue
    add(TABLE_LABEL[p.lootTable], { id: p.id, x: p.position[0], z: p.position[2], fixed: false })
  }
  for (const f of FIXED_SPAWNS) {
    if (f.item !== item) continue
    const zone = ZONES.find((z) => z.id === f.zone)?.name ?? 'the grounds'
    add(`in ${zone}`, { id: f.id, x: f.position[0], z: f.position[2], fixed: true })
  }
  if (MERCHANT_ROWS.some((r) => r.item === item)) add(MERCHANT_LABEL)
  if (ELITE_DROPS.some((d) => d.item === item)) add(ELITE_LABEL)
  if (out.length === 0 && STARTING_ITEMS.has(item)) add(START_LABEL)
  return out
}

export interface Here {
  x: number
  z: number
}

const nearestDistance = (s: ItemSource, from: Here): number =>
  s.points.length === 0
    ? Infinity
    : Math.min(...s.points.map((p) => Math.hypot(p.x - from.x, p.z - from.z)))

/**
 * The places to name for an item: at most `max`, the nearest first. The merchant and elite drops
 * have no position, so they come after every place on the map (merchant before elites).
 */
export function sourcePhrases(item: ItemId, from: Here = { x: 0, z: 0 }, max = 2): string[] {
  return itemSources(item)
    .map((s, i) => ({ s, i, d: nearestDistance(s, from) }))
    .sort((a, b) => (a.d === b.d ? a.i - b.i : a.d - b.d))
    .slice(0, max)
    .map((e) => e.s.label)
}

/** "dug from grave mounds, found in coffins". */
export const joinSources = (phrases: readonly string[]): string => phrases.join(', ')

/** "dug from grave mounds or found in coffins". */
export const orSources = (phrases: readonly string[]): string => phrases.join(' or ')

/** What the world holds right now, for choosing a place to mark. */
export interface SourceWorld {
  /** Material stacks lying at each spawn point id (spawnStore world.materials). */
  materials: Readonly<Record<string, readonly ItemStack[]>>
  /** Graves dug, by spawn point id → the day (digStore dig.dugOnDay). */
  dugOnDay: Readonly<Record<string, number>>
  day: number
  phase: Phase
  collectedFixed: readonly string[]
}

export interface MarkTarget {
  x: number
  z: number
  name: string
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** True when this point still has the item today: not looted, not dug, not taken. */
function isAvailable(point: SourcePoint, item: ItemId, world: SourceWorld): boolean {
  if (point.fixed) {
    const spawn = FIXED_SPAWNS.find((f) => f.id === point.id)
    if (!spawn || world.collectedFixed.includes(point.id)) return false
    return !spawn.nightOnly || world.phase === 'night'
  }
  const lying = (world.materials[point.id] ?? []).some((s) => s.item === item && s.qty > 0)
  if (lying) return true
  // An undug grave holds nothing on the surface: its loot is rolled when the player digs.
  const grave = SPAWN_POINTS.find((p) => p.id === point.id)
  return grave?.lootTable === 'grave-dig' && world.dugOnDay[point.id] !== world.day
}

/**
 * The nearest place that still has the item today, as a pin target, or null when none is left
 * (everything looted, dug or taken, or the only sources are the merchant and elite drops).
 */
export function nearestSource(item: ItemId, from: Here, world: SourceWorld): MarkTarget | null {
  let best: MarkTarget | null = null
  let bestD = Infinity
  for (const s of itemSources(item)) {
    for (const p of s.points) {
      if (!isAvailable(p, item, world)) continue
      const d = Math.hypot(p.x - from.x, p.z - from.z)
      if (d < bestD) {
        bestD = d
        best = { x: p.x, z: p.z, name: capitalize(s.label) }
      }
    }
  }
  return best
}

export const NONE_LEFT_TEXT = 'None left today. Try again tomorrow'
