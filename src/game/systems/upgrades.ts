// Weapon upgrades and derived stats — pure TypeScript. Req 8.13, 11.1–11.11.

import type { FirearmId, HeavyMeleeId, Inventory, ItemId, ItemStack, UpgradeId } from '../types'
import type { FirearmDef } from '../../data/firearms'
import type { StatKey } from '../../data/upgrades'
import { FIREARM_MAP } from '../../data/firearms'
import { HEAVY_MAP } from '../../data/heavyMelee'
import { ITEM_MAP } from '../../data/items'
import { UPGRADE_MAP, WEAPON_UPGRADES } from '../../data/upgrades'
import { WEAPON_MAP } from '../../data/weapons'
import { upgradedStat } from './heavyAttack'
import { countItem, removeItem } from './inventory'

export type MissingStack = { item: ItemId; qty: number }

export type UpgradeRefusal = 'unknown' | 'already-bought' | 'weapon-not-owned' | 'missing'

export type UpgradeCheck =
  | { ok: true }
  | { ok: false; reason: UpgradeRefusal; missing?: MissingStack[] }

export type BuyResult =
  | { ok: true; inv: Inventory; bought: UpgradeId[] }
  | { ok: false; reason: UpgradeRefusal; missing?: MissingStack[] }

/**
 * Hook for spec 08 (Steady Hands, Marksman). Spec 07 passes none.
 * Multipliers apply after upgrades, so they stack with them.
 */
export interface StatMods {
  /** Multiplies reload time (Steady Hands: 0.85 per rank). */
  reloadMult?: number
  /** Added to the headshot multiplier (Marksman: +0.25). */
  headshotAdd?: number
}

export type WeaponStats = Partial<Record<StatKey, number>>

export interface FirearmStats extends FirearmDef {
  /** Aimed spread, never wider than hip. */
  spreadAimedDeg: number
}

/** Upgrades for weapons the satchel holds, in table order (Req 11.1). */
export function listableUpgrades(inv: Inventory): UpgradeId[] {
  return WEAPON_UPGRADES.filter((u) => countItem(inv, u.weapon) > 0).map((u) => u.id)
}

/** Cost entries the satchel lacks, with duplicate cost rows summed. */
function shortfall(inv: Inventory, cost: readonly ItemStack[]): MissingStack[] {
  const need = new Map<ItemId, number>()
  for (const c of cost) need.set(c.item, (need.get(c.item) ?? 0) + c.qty)
  const out: MissingStack[] = []
  for (const [item, qty] of need) {
    const lack = qty - countItem(inv, item)
    if (lack > 0) out.push({ item, qty: lack })
  }
  return out
}

export function canBuyUpgrade(
  inv: Inventory,
  bought: readonly UpgradeId[],
  id: UpgradeId,
): UpgradeCheck {
  const def = UPGRADE_MAP[id]
  if (!def) return { ok: false, reason: 'unknown' }
  if (bought.includes(id)) return { ok: false, reason: 'already-bought' }
  if (countItem(inv, def.weapon) <= 0) return { ok: false, reason: 'weapon-not-owned' }
  const missing = shortfall(inv, def.cost)
  if (missing.length > 0) return { ok: false, reason: 'missing', missing }
  return { ok: true }
}

/** Removes the whole cost and records the upgrade in one step, or changes nothing. */
export function buyUpgrade(
  inv: Inventory,
  bought: readonly UpgradeId[],
  id: UpgradeId,
): BuyResult {
  const check = canBuyUpgrade(inv, bought, id)
  if (!check.ok) return check
  let next = inv
  for (const c of UPGRADE_MAP[id].cost) next = removeItem(next, c.item, c.qty).inv
  return { ok: true, inv: next, bought: [...bought, id] }
}

function baseStats(weapon: FirearmId | HeavyMeleeId): WeaponStats {
  if (weapon === 'revolver' || weapon === 'shotgun') {
    const f = FIREARM_MAP[weapon]
    return {
      capacity: f.capacity,
      reloadS: f.reloadS,
      damage: f.damage,
      pelletDamage: f.damage,
      spreadHipDeg: f.spreadHipDeg,
    }
  }
  const h = HEAVY_MAP[weapon]
  const w = WEAPON_MAP[weapon]
  return {
    lightDamage: w.damage,
    heavyDamage: h.heavyDamage,
    heavyStaminaCost: h.staminaCost,
    ...(w.durability === null ? {} : { durability: w.durability }),
  }
}

/** Stats with upgrades folded in by each change's `to` value, so buy order never matters. */
export function deriveStats(
  weapon: FirearmId | HeavyMeleeId,
  bought: readonly UpgradeId[],
  mods: StatMods = {},
): WeaponStats {
  const base = baseStats(weapon)
  const out: WeaponStats = {}
  for (const key of Object.keys(base) as StatKey[]) {
    out[key] = upgradedStat(weapon, key, base[key] as number, bought)
  }
  if (out.reloadS !== undefined && mods.reloadMult !== undefined) out.reloadS *= mods.reloadMult
  return out
}

/** Full firearm numbers: the table row with upgrades and mods applied. */
export function firearmStats(
  id: FirearmId,
  bought: readonly UpgradeId[],
  mods: StatMods = {},
): FirearmStats {
  const def = FIREARM_MAP[id]
  const s = deriveStats(id, bought, mods)
  const spreadHipDeg = s.spreadHipDeg ?? def.spreadHipDeg
  // Id-specific stat: the revolver's `damage` and the shotgun's `pelletDamage`.
  const damage = (id === 'shotgun' ? s.pelletDamage : s.damage) ?? def.damage
  return {
    ...def,
    capacity: s.capacity ?? def.capacity,
    reloadS: s.reloadS ?? def.reloadS,
    damage,
    spreadHipDeg,
    // Choke narrows hip only; aiming must never be worse than the hip.
    spreadAimedDeg: Math.min(def.spreadAimedDeg, spreadHipDeg),
    headshotMult: def.headshotMult + (mods.headshotAdd ?? 0),
  }
}

const STAT_LABEL: Record<StatKey, string> = {
  capacity: 'Capacity',
  reloadS: 'Reload',
  damage: 'Damage',
  spreadHipDeg: 'Spread',
  pelletDamage: 'Pellet damage',
  durability: 'Durability',
  lightDamage: 'Damage',
  heavyDamage: 'Heavy damage',
  heavyStaminaCost: 'Heavy attack stamina',
}

const STAT_UNIT: Partial<Record<StatKey, string>> = {
  reloadS: ' s',
  spreadHipDeg: '°',
}

/** "Capacity 6 → 8" lines, one per changed stat. */
export function upgradeLines(id: UpgradeId): string[] {
  const def = UPGRADE_MAP[id]
  if (!def) return []
  return def.changes.map((c) => {
    const unit = STAT_UNIT[c.stat] ?? ''
    return `${STAT_LABEL[c.stat]} ${c.from}${unit} → ${c.to}${unit}`
  })
}

/** "Need 2 more iron nails" for a shortfall list. */
export function missingReason(missing: readonly MissingStack[]): string {
  if (missing.length === 0) return ''
  const parts = missing.map((m) => `${m.qty} more ${ITEM_MAP[m.item]?.name.toLowerCase() ?? m.item}`)
  return `Need ${parts.join(', ')}`
}
