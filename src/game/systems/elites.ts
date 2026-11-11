// Elite zombie rules — pure TypeScript, no React / three.js / Howler.
//
// Which spawns may become elites, their stat multipliers, and the one drop an
// elite leaves behind. Numbers live in src/data/elites.ts.

import { ELITE, ELITE_AMMO_SUBSTITUTES, ELITE_DROPS, type EliteDrop } from '../../data/elites'
import type { EnemyId } from '../../data/enemies'
import type { Rng } from '../rng'
import type { Inventory } from '../types'
import { addItem, countItem } from './inventory'
import type { Vec3, WorldDrop } from './satchel'

/** Night ≥ fromNight, an eligible type, and no elite in this wave yet. */
export function canBeElite(type: EnemyId, night: number, waveHasElite: boolean): boolean {
  if (waveHasElite) return false
  if (!Number.isFinite(night) || night < ELITE.fromNight) return false
  return ELITE.eligible.includes(type)
}

/**
 * Rolls the elite chance. The rng is consumed only when the spawn is eligible,
 * so waves with no eligible spawns keep their seeded sequence unchanged.
 */
export function rollElite(
  rng: Rng,
  type: EnemyId,
  night: number,
  waveHasElite: boolean,
  chance: number = ELITE.chance.normal,
): boolean {
  if (!canBeElite(type, night, waveHasElite)) return false
  return rng() < chance
}

export interface EliteBase {
  hp: number
  speed: number
  damage: number
}

export function eliteStats(base: EliteBase): EliteBase {
  return {
    hp: base.hp * ELITE.hpMult,
    speed: base.speed * ELITE.speedMult,
    damage: base.damage * ELITE.damageMult,
  }
}

export interface OwnedGuns {
  revolver: boolean
  shotgun: boolean
}

/** Owned = the gun is in the satchel, or the combat store already tracks its magazine. */
export function ownedGuns(
  inv: Inventory,
  firearms: Partial<Record<'revolver' | 'shotgun', unknown>>,
): OwnedGuns {
  return {
    revolver: countItem(inv, 'revolver') > 0 || firearms.revolver !== undefined,
    shotgun: countItem(inv, 'shotgun') > 0 || firearms.shotgun !== undefined,
  }
}

/** The drop table as it applies now: ammo rows for guns the player lacks become materials. */
export function eliteDropTable(owned: OwnedGuns): readonly EliteDrop[] {
  return ELITE_DROPS.map((d) => {
    const needs =
      d.item === 'revolver-cartridge' ? owned.revolver : d.item === 'shotgun-shell' ? owned.shotgun : true
    if (needs) return d
    const sub = ELITE_AMMO_SUBSTITUTES[d.item as keyof typeof ELITE_AMMO_SUBSTITUTES]
    return { item: sub.item, qty: sub.qty, weight: d.weight }
  })
}

/** Weighted pick from the drop table; both guns count as owned unless told otherwise. */
export function rollEliteDrop(rng: Rng, owned: OwnedGuns = { revolver: true, shotgun: true }): EliteDrop {
  const table = eliteDropTable(owned)
  const total = table.reduce((sum, d) => sum + d.weight, 0)
  let pick = rng() * total
  for (const d of table) {
    pick -= d.weight
    if (pick < 0) return d
  }
  return table[table.length - 1]
}

export interface EliteDropPlacement {
  inv: Inventory
  /** What did not fit in the satchel, lying where the elite died; null when it all fit. */
  ground: WorldDrop | null
  added: number
}

/** Satchel first; whatever is refused becomes a ground pickup at `at`, so a drop is never lost. */
export function placeEliteDrop(
  inv: Inventory,
  drop: EliteDrop,
  at: Vec3,
  id: string,
): EliteDropPlacement {
  const res = addItem(inv, drop.item, drop.qty)
  return {
    inv: res.inv,
    added: res.added,
    ground: res.rejected > 0 ? { id, item: drop.item, qty: res.rejected, position: at } : null,
  }
}
