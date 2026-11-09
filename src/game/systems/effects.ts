// Timed effects: pure TypeScript, no React / three.js / Howler.
//
// One shared buff list. An effect id appears at most once; applying it again
// refreshes it to full time and never stacks (Req 12.4, 12.11, 12.13).
// Time only goes down and never below zero (Req 12.5, 12.12).

import { EFFECT_MAP, MAX_SHOWN_EFFECTS } from '../../data/effects'
import type { EffectId } from '../types'
import type { SaltCircle } from './projectiles'

export interface ActiveEffect {
  id: EffectId
  leftS: number
}

export interface EffectMods {
  firearmDamage: number
  moveSpeed: number
  sprintDrain: number
}

export interface EffectIconView {
  id: EffectId
  glyph: string
  /** Remaining time as 0..1 of the full duration, for the countdown ring. */
  fraction: number
  secondsText: string
}

/** Refreshes to the full duration; never adds a second entry. */
export function applyEffect(list: readonly ActiveEffect[], id: EffectId): ActiveEffect[] {
  const fresh: ActiveEffect = { id, leftS: EFFECT_MAP[id].durationS }
  const has = list.some((e) => e.id === id)
  return has ? list.map((e) => (e.id === id ? fresh : { ...e })) : [...list.map((e) => ({ ...e })), fresh]
}

/** Drops entries that reach 0 on the same step, so mods revert at once (Req 12.5). */
export function tickEffects(list: readonly ActiveEffect[], dt: number): ActiveEffect[] {
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0
  return list
    .map((e) => ({ ...e, leftS: Math.max(0, e.leftS - step) }))
    .filter((e) => e.leftS > 0)
}

/** Multipliers from all active effects; 1 when none applies. */
export function effectMods(list: readonly ActiveEffect[]): EffectMods {
  const out: EffectMods = { firearmDamage: 1, moveSpeed: 1, sprintDrain: 1 }
  for (const e of list) {
    if (e.leftS <= 0) continue
    const m = EFFECT_MAP[e.id].mods
    if (m.firearmDamage !== undefined) out.firearmDamage = m.firearmDamage
    if (m.moveSpeed !== undefined) out.moveSpeed = m.moveSpeed
    if (m.sprintDrain !== undefined) out.sprintDrain = m.sprintDrain
  }
  return out
}

/**
 * The Salt Circle entry is derived from the circles themselves (they already
 * count down), so there is no second timer to drift. It shows the newest
 * circle, i.e. the one with the most time left (Req 12.3).
 */
export function withSaltEffect(
  list: readonly ActiveEffect[],
  salts: readonly SaltCircle[],
): ActiveEffect[] {
  const rest = list.filter((e) => e.id !== 'salt-circle').map((e) => ({ ...e }))
  const left = salts.reduce((m, c) => Math.max(m, c.remaining), 0)
  if (left <= 0) return rest
  return [...rest, { id: 'salt-circle', leftS: Math.min(left, EFFECT_MAP['salt-circle'].durationS) }]
}

/** At most 6 icons, each with a glyph and a seconds text (Req 12.9). */
export function effectIcons(list: readonly ActiveEffect[]): EffectIconView[] {
  return list
    .filter((e) => e.leftS > 0)
    .slice(0, MAX_SHOWN_EFFECTS)
    .map((e) => {
      const def = EFFECT_MAP[e.id]
      return {
        id: e.id,
        glyph: def.glyph,
        fraction: Math.min(1, Math.max(0, e.leftS / def.durationS)),
        secondsText: `${Math.ceil(e.leftS)}s`,
      }
    })
}
