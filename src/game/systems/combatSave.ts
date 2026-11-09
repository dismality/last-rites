// Combat save sanitising — pure TypeScript. Req 19.1–19.8.
//
// A save is read field by field: an invalid entry is replaced by its default
// and every valid entry is kept, so one bad value never wipes the rest.

import { BOARD_HP_MAX_SAVE, DOORS } from '../../data/barricades'
import { ITEM_MAP } from '../../data/items'
import { UPGRADE_MAP } from '../../data/upgrades'
import { WEAPON_PICKUPS } from '../../data/weaponPickups'
import type { WeaponPickupId } from '../../data/weaponPickups'
import type { DoorId, FirearmId, Inventory, ItemId, UpgradeId } from '../types'
import { maxDurability } from './durability'
import { countItem } from './inventory'
import { isBarricadeBuilt } from './repairs'
import type { ChapelState } from './repairs'
import { firearmStats } from './upgrades'

/** Melee weapons that wear out. Thrown and placed items are single use and not tracked. */
export type DurableId = 'bone-club' | 'sharpened-shovel' | 'wood-axe'

export const DURABLE_IDS: readonly DurableId[] = ['bone-club', 'sharpened-shovel', 'wood-axe']

const FIREARM_IDS: readonly FirearmId[] = ['revolver', 'shotgun']
const PICKUP_IDS: readonly WeaponPickupId[] = WEAPON_PICKUPS.map((p) => p.id)

export interface CombatSave {
  firearms: Partial<Record<FirearmId, { magazine: number }>>
  durability: Partial<Record<DurableId, number>>
  upgrades: UpgradeId[]
  takenPickups: WeaponPickupId[]
  doors: { built: boolean; front: number[]; vestry: number[] }
}

export interface CombatSaveContext {
  inventory: Inventory
  chapel: ChapelState
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

const has = (o: Obj, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key)

/** Magazine a weapon starts with when its saved value is unusable. */
const defaultMagazine = (id: FirearmId, capacity: number): number => {
  const m = WEAPON_PICKUPS.find((p) => p.id === id)?.magazine
  return Math.min(m ?? capacity, capacity)
}

function sanitizeUpgrades(raw: unknown, inv: Inventory): UpgradeId[] {
  if (!Array.isArray(raw)) return []
  const out: UpgradeId[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || !has(UPGRADE_MAP as unknown as Obj, id)) continue
    const up = id as UpgradeId
    // An upgrade for a weapon the player no longer holds is dropped (Req 19.5).
    if (countItem(inv, UPGRADE_MAP[up].weapon) <= 0 || out.includes(up)) continue
    out.push(up)
  }
  return out
}

function sanitizeFirearms(
  raw: unknown,
  inv: Inventory,
  upgrades: readonly UpgradeId[],
): CombatSave['firearms'] {
  const out: CombatSave['firearms'] = {}
  if (!isObj(raw)) return out
  for (const id of FIREARM_IDS) {
    if (!has(raw, id) || countItem(inv, id) <= 0) continue
    const capacity = firearmStats(id, upgrades).capacity
    const entry = raw[id]
    const m = isObj(entry) ? entry.magazine : undefined
    out[id] = { magazine: isInt(m) && m >= 0 && m <= capacity ? m : defaultMagazine(id, capacity) }
  }
  return out
}

function sanitizeDurability(
  raw: unknown,
  inv: Inventory,
  upgrades: readonly UpgradeId[],
): CombatSave['durability'] {
  const out: CombatSave['durability'] = {}
  if (!isObj(raw)) return out
  for (const id of DURABLE_IDS) {
    if (!has(raw, id) || countItem(inv, id) <= 0) continue
    const max = maxDurability(id, upgrades)
    if (max === null) continue
    const v = raw[id]
    out[id] = isInt(v) && v >= 1 && v <= max ? v : max
  }
  return out
}

function sanitizeBoards(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback
  const valid = raw.filter((b): b is number => isInt(b) && b >= 1 && b <= BOARD_HP_MAX_SAVE)
  return valid.slice(0, DOORS.slots)
}

function sanitizeDoors(raw: unknown, chapel: ChapelState): CombatSave['doors'] {
  const stage1 = isBarricadeBuilt(chapel)
  const o = isObj(raw) ? raw : {}
  // Pre-07 saves have no door block: stage 1 done means the barricades exist.
  const built = typeof o.built === 'boolean' ? o.built : stage1
  const fresh = (): number[] => (built ? Array.from({ length: DOORS.startBoards }, () => DOORS.boardHp) : [])
  const doors: Record<DoorId, number[]> = {
    front: sanitizeBoards(o.front, fresh()),
    vestry: sanitizeBoards(o.vestry, fresh()),
  }
  return { built, front: doors.front, vestry: doors.vestry }
}

/** Reads the `combat` block of a save. Never throws; junk or a missing block gives defaults. */
export function sanitizeCombat(raw: unknown, ctx: CombatSaveContext): CombatSave {
  const o = isObj(raw) ? raw : {}
  const upgrades = sanitizeUpgrades(o.upgrades, ctx.inventory)
  const taken = Array.isArray(o.takenPickups) ? o.takenPickups : []
  const takenPickups = PICKUP_IDS.filter((id) => taken.includes(id))
  return {
    firearms: sanitizeFirearms(o.firearms, ctx.inventory, upgrades),
    durability: sanitizeDurability(o.durability, ctx.inventory, upgrades),
    upgrades,
    takenPickups,
    doors: sanitizeDoors(o.doors, ctx.chapel),
  }
}

/**
 * Drops satchel slot entries that cannot be real (unknown item, non-integer or
 * non-positive quantity, quantity above the stack limit) and nulls hotbar entries
 * that name a dropped item (Req 19.4). A structurally wrong inventory is returned
 * untouched so the caller's structural check still rejects it (Req 19.6).
 */
export function sanitizeInventorySlots(raw: unknown): unknown {
  if (!isObj(raw) || !Array.isArray(raw.slots)) return raw
  const kept: unknown[] = []
  const droppedIds = new Set<unknown>()
  for (const s of raw.slots) {
    const def = isObj(s) && typeof s.item === 'string' ? ITEM_MAP[s.item as ItemId] : undefined
    if (def && isObj(s) && isInt(s.qty) && s.qty >= 1 && s.qty <= def.stackLimit) kept.push(s)
    else if (isObj(s)) droppedIds.add(s.item)
  }
  const keptIds = new Set(kept.map((s) => (s as Obj).item))
  const hotbar = Array.isArray(raw.hotbar)
    ? raw.hotbar.map((h) =>
        typeof h === 'string' && (!ITEM_MAP[h as ItemId] || (droppedIds.has(h) && !keptIds.has(h))) ? null : h,
      )
    : raw.hotbar
  return { ...raw, slots: kept, hotbar }
}
