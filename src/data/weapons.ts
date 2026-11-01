// Weapon / tool definitions — source of truth mirrored from docs/game-design.md §4.
// Pure data: no logic, no side effects.

import type { CraftedItemId } from '../game/types'

export interface WeaponDef {
  id: CraftedItemId
  name: string
  kind: 'melee' | 'thrown' | 'placed' | 'consumable'
  damage: number
  /** Attack / use interval in seconds. null for placed/consumable items. */
  cooldown: number | null
  /** Hit capacity before breaking. null = indestructible. */
  durability: number | null
  /** Blast radius in metres (thrown/placed weapons only). */
  radius?: number
  /** Healing amount (consumables only). */
  heals?: number
  /** Fuel restored as a fraction 0–1 (consumables only). */
  fuelRestore?: number
  /** Duration in seconds (placed items). */
  duration?: number
  /** Whether the item can also dig graves. */
  canDig?: boolean
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'rusty-shovel',
    name: 'Rusty Shovel',
    kind: 'melee',
    damage: 15,
    cooldown: 0.9,
    durability: null,
    canDig: true,
  },
  {
    id: 'bone-club',
    name: 'Bone Club',
    kind: 'melee',
    damage: 25,
    cooldown: 0.6,
    durability: 30,
  },
  {
    id: 'sharpened-shovel',
    name: 'Sharpened Shovel',
    kind: 'melee',
    damage: 35,
    cooldown: 0.9,
    durability: 50,
    canDig: true,
  },
  {
    id: 'holy-water-flask',
    name: 'Holy Water Flask',
    kind: 'thrown',
    damage: 40,
    cooldown: null,
    durability: 1,
    radius: 2,
  },
  {
    id: 'lantern-trap',
    name: 'Lantern Trap',
    kind: 'placed',
    damage: 10, // per second, for 5 s
    cooldown: null,
    durability: 1,
    duration: 5,
  },
  {
    id: 'nail-bomb',
    name: 'Consecrated Nail Bomb',
    kind: 'thrown',
    damage: 80,
    cooldown: null,
    durability: 1,
    radius: 3,
  },
  {
    id: 'salt-circle',
    name: 'Salt Circle',
    kind: 'placed',
    damage: 0,
    cooldown: null,
    durability: 1,
    radius: 2,
    duration: 30,
  },
  {
    id: 'bandage',
    name: 'Bandage',
    kind: 'consumable',
    damage: 0,
    cooldown: 2,
    durability: 1,
    heals: 30,
  },
  {
    id: 'tallow-candle',
    name: 'Tallow Candle',
    kind: 'placed',
    damage: 0,
    cooldown: null,
    durability: 1,
    duration: 120,
  },
  {
    id: 'lantern-refill',
    name: 'Lantern Refill',
    kind: 'consumable',
    damage: 0,
    cooldown: null,
    durability: 1,
    fuelRestore: 0.5,
  },
]

export const WEAPON_MAP: Readonly<Record<CraftedItemId, WeaponDef>> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
) as Readonly<Record<CraftedItemId, WeaponDef>>
