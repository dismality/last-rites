// Objective selector (design bible §11, Req 3). Pure: no store or clock access. The
// first matching rule wins; rule 11 is the fallback, so the result is total.

import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import {
  OBJECTIVE_MAX_LINE,
  OBJECTIVE_RULES,
  type ObjectiveRuleDef,
  type ObjectiveRuleId,
} from '../../data/objectiveRules'
import { FIXED_SPAWNS } from '../../data/zones'
import type { Phase } from '../types'

export type Vec3 = readonly [number, number, number]

export interface ObjectiveInput {
  phase: Phase
  nightNumber: number
  /** Seconds left in the current day or dusk phase. */
  secondsLeft: number
  waves: { running: boolean; index: number; total: number; zombiesLeft: number }
  rite: { available: boolean; running: boolean; craneAlive: boolean }
  progress: {
    page1Read: boolean
    cryptKey: boolean
    whistle: boolean
    stairRevealed: boolean
    ossuaryKey: boolean
    relics: number
  }
  /**
   * Uncollected relic sites whose map cell is already explored. The caller filters, so
   * the tracker can never point at a site the player has not discovered (pillar 3).
   */
  relicSites: readonly Vec3[]
  playerPos: Vec3
}

export interface Objective {
  rule: ObjectiveRuleId
  main: string
  second: string
  position?: Vec3
  marker?: string
}

const RELIC_TARGET = 5
const FINAL_NIGHT = 5

/**
 * Second lines for rules 2 and 3. The data has no template for them and the design is
 * silent, so they state the one thing the player needs to know in that moment.
 */
const RITE_SECOND = 'Place the relics on the altar'
const CRANE_SECOND = 'The rite cannot finish while he stands'

const finite = (n: number): number => (Number.isFinite(n) ? n : 0)
const clampInt = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.floor(finite(n))))
const cut = (s: string): string => s.slice(0, OBJECTIVE_MAX_LINE)

/** `m:ss`, never negative. Rounds up so 0:00 shows only when time has run out. */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.ceil(finite(seconds)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** The tutorial prompt takes the second line's place; null falls back to the objective's own. */
export const composeSecondLine = (o: Objective, prompt: string | null): string =>
  prompt !== null ? prompt : o.second

const ruleDef = (id: ObjectiveRuleId): ObjectiveRuleDef => {
  const def = OBJECTIVE_RULES.find((r) => r.id === id)
  if (!def) throw new Error(`Missing objective rule ${id}`)
  return def
}

const dist2 = (a: Vec3, b: Vec3): number => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2

/** First matching rule id, in ascending priority order. */
const matchRule = (i: ObjectiveInput): ObjectiveRuleId => {
  const night = i.phase === 'night'
  const day = i.phase === 'day'
  const p = i.progress
  if (night && i.waves.running) return 1
  if (night && i.nightNumber === FINAL_NIGHT && i.rite.available) return 2
  if (night && i.nightNumber === FINAL_NIGHT && i.rite.running && i.rite.craneAlive) return 3
  if (i.phase === 'dusk') return 4
  if (day && !p.page1Read) return 5
  if (day && !p.cryptKey) return 6
  if (day && !p.whistle) return 7
  if (day && !p.stairRevealed) return 8
  if (day && !p.ossuaryKey) return 9
  if (day && clampInt(p.relics, 0, RELIC_TARGET) < RELIC_TARGET) return 10
  return 11
}

const resolvePosition = (def: ObjectiveRuleDef, i: ObjectiveInput): Vec3 | undefined => {
  const place = def.place
  if (!place) return undefined
  switch (place.kind) {
    case 'altar':
      return CHAPEL_ALTAR
    case 'fixed-spawn':
      return FIXED_SPAWNS.find((f) => f.id === place.id)?.position
    case 'nearest-relic': {
      let best: Vec3 | undefined
      let bestD = Infinity
      for (const site of i.relicSites) {
        const d = dist2(site, i.playerPos)
        if (d < bestD) {
          bestD = d
          best = site
        }
      }
      return best
    }
  }
}

const mainLine = (def: ObjectiveRuleDef, i: ObjectiveInput): string => {
  if (def.id === 1) {
    const total = Math.max(1, clampInt(i.waves.total, 1, Number.MAX_SAFE_INTEGER))
    const n = clampInt(i.waves.index, 1, total)
    return def.main.replace('{n}', String(n)).replace('{m}', String(total))
  }
  if (def.target === undefined) return def.main
  const relics = clampInt(i.progress.relics, 0, RELIC_TARGET)
  // Rules 5, 6, 7 and 9 only match while their item is missing, except the page, which
  // can never be read here either, so their count is always 0 of 1.
  const count = def.id === 2 || def.id === 10 ? relics : 0
  return `${def.main} (${count}/${def.target})`
}

const secondLine = (def: ObjectiveRuleDef, i: ObjectiveInput): string => {
  if (def.id === 2) return RITE_SECOND
  if (def.id === 3) return CRANE_SECOND
  const t = def.second ?? ''
  return t
    .replace('{k}', String(Math.max(0, Math.floor(finite(i.waves.zombiesLeft)))))
    .replace('{clock}', formatClock(i.secondsLeft))
}

export const selectObjective = (i: ObjectiveInput): Objective => {
  const def = ruleDef(matchRule(i))
  const position = resolvePosition(def, i)
  const result: Objective = {
    rule: def.id,
    main: cut(mainLine(def, i)),
    second: cut(secondLine(def, i)),
  }
  if (position) result.position = position
  if (def.marker) result.marker = def.marker
  return result
}
