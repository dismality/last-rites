// Heavy attack charge and release rules — pure TypeScript.
// Req 8.1–8.5, 8.9, 8.13, 8.14.

import type { HeavyMeleeId, UpgradeId } from '../types'
import type { EnemyId } from '../../data/enemies'
import type { StatKey } from '../../data/upgrades'
import { UPGRADE_MAP } from '../../data/upgrades'
import { HEAVY_MAP } from '../../data/heavyMelee'
import { WEAPON_MAP } from '../../data/weapons'
import type { WeaponDef } from '../../data/weapons'

export interface ChargeState {
  heldS: number
  /** True for the V key: the release fires by itself on the tick the meter fills. */
  auto: boolean
}

/** Heavy weapon numbers after upgrades. */
export interface HeavyStats {
  id: HeavyMeleeId
  chargeS: number
  lightDamage: number
  heavyDamage: number
  staminaCost: number
  knockdownS: number
  wailerBonus: number
}

export type ReleaseKind = 'normal' | 'heavy'

export interface ReleaseResult {
  kind: ReleaseKind
  tooTired: boolean
  staminaSpent: number
}

/**
 * Fold the bought upgrades for `weapon` over a base stat value. Taking each change's
 * `to` value (rather than a delta) keeps the result independent of buying order.
 */
export function upgradedStat(
  weapon: string,
  stat: StatKey,
  base: number,
  upgrades: readonly UpgradeId[],
): number {
  let value = base
  for (const id of upgrades) {
    const def = UPGRADE_MAP[id]
    if (!def || def.weapon !== weapon) continue
    for (const c of def.changes) if (c.stat === stat) value = c.to
  }
  return value
}

/** Stats for a heavy weapon with the given upgrades applied (Req 8.13). */
export function heavyStatsFor(id: HeavyMeleeId, upgrades: readonly UpgradeId[] = []): HeavyStats {
  const h = HEAVY_MAP[id]
  return {
    id,
    chargeS: h.chargeS,
    lightDamage: upgradedStat(id, 'lightDamage', WEAPON_MAP[id].damage, upgrades),
    heavyDamage: upgradedStat(id, 'heavyDamage', h.heavyDamage, upgrades),
    staminaCost: upgradedStat(id, 'heavyStaminaCost', h.staminaCost, upgrades),
    knockdownS: h.knockdownS,
    wailerBonus: h.wailerBonus,
  }
}

export const startCharge = (auto: boolean): ChargeState => ({ heldS: 0, auto })

/** The meter only grows and stops at the full charge time. */
export function tickCharge(
  c: ChargeState,
  dt: number,
  chargeS: number,
): { charge: ChargeState; full: boolean; autoRelease: boolean } {
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0
  const heldS = Math.min(Math.max(c.heldS, 0) + step, chargeS)
  const full = heldS >= chargeS
  return { charge: { ...c, heldS }, full, autoRelease: full && c.auto }
}

/**
 * Decide what a release does. A partial charge is a normal swing; a full charge
 * spends stamina only when the player can afford it, otherwise it falls back to
 * a normal swing with the "too tired" cue.
 */
export function resolveRelease(c: ChargeState, h: HeavyStats, stamina: number): ReleaseResult {
  if (c.heldS < h.chargeS) return { kind: 'normal', tooTired: false, staminaSpent: 0 }
  if (stamina >= h.staminaCost) return { kind: 'heavy', tooTired: false, staminaSpent: h.staminaCost }
  return { kind: 'normal', tooTired: true, staminaSpent: 0 }
}

function isHeavyStats(w: HeavyStats | WeaponDef): w is HeavyStats {
  return 'heavyDamage' in w
}

/** Damage of one swing against `target`; the sabre's Wailer bonus applies to both kinds. */
export function meleeDamageFor(
  w: HeavyStats | WeaponDef,
  kind: ReleaseKind,
  target: EnemyId,
): number {
  if (!isHeavyStats(w)) return w.damage
  const base = kind === 'heavy' ? w.heavyDamage : w.lightDamage
  return target === 'wailer' ? base * (1 + w.wailerBonus) : base
}
