// Objective selector (design bible §11, Req 3). Pure: no store or clock access. The
// first matching rule wins; rule 11 is the fallback, so the result is total.

import { BENCH_Z, CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import {
  ALTAR_LOCKED_LINE,
  CASE_SOLVE_LINE,
  CURSE_RULE,
  OBJECTIVE_MAX_LINE,
  OBJECTIVE_RULES,
  PREPARE_WEAPON_BEFORE_DUSK_S,
  PREPARE_WEAPON_RULE,
  type ObjectiveRuleDef,
  type ObjectiveRuleId,
} from '../../data/objectiveRules'
import { CURSE_MAX, STAGE_COUNT, STAGE_MAP } from '../../data/stages'
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
  /** False for Endless: no story rules (5-10) and no rite rules (2-3). Absent means story. */
  story?: boolean
  /** The player owns no weapon except the Rusty Shovel (rule 12). Absent means false. */
  needsWeapon?: boolean
  /**
   * Story stage mode (spec 10). When present the night line is the curse line (no wave count),
   * the rite belongs to stage 3, and the day fallback names the case. Absent keeps the
   * five-night rules, which Endless and the older tests use.
   */
  stage?: {
    stage: 1 | 2 | 3
    /** Correct clue links made on the case board; each one lowers the Curse meter. */
    curseLinks: number
    /** Whole seconds the altar stays silent after a wrong answer; 0 when it listens. */
    altarLockedS: number
    /** Clues found for the case, when the case board can say. */
    clues?: { found: number; total: number }
  }
}

export interface Objective {
  rule: ObjectiveRuleId
  main: string
  second: string
  position?: Vec3
  marker?: string
  /** Set on the curse line: the HUD draws the number and bar from it. */
  curse?: { value: number; max: number }
}

/** Curse meter value: starts full and falls one per correct link, never below 0. */
export const curseValue = (links: number): number =>
  Math.max(0, CURSE_MAX - clampInt(links, 0, CURSE_MAX))

/** The workbench centre in the hut (x 0, against the north wall). */
const WORKBENCH_POS: Vec3 = [0, 0, BENCH_Z]

const RELIC_TARGET = 5
const FINAL_NIGHT = 5

/**
 * Second lines for rules 2 and 3. The data has no template for them and the design is
 * silent, so they state the one thing the player needs to know in that moment.
 */
const ENDLESS_DAY_MAIN = 'Prepare for the night'
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
  // Rite rules come before the wave line: wave state lingers during the final rite and
  // the Crane fight, and "Survive: Wave 1 of 5" is wrong once the rite has begun.
  const story = i.story !== false
  // In stage mode the rite belongs to the last stage; the curse line holds every other night.
  const finalNight =
    story && night && (i.stage ? i.stage.stage === STAGE_COUNT : i.nightNumber === FINAL_NIGHT)
  if (finalNight && i.rite.running && i.rite.craneAlive) return 3
  if (finalNight && (i.rite.available || i.rite.running)) return 2
  if (night && story && i.stage) return 1
  if (night && i.waves.running) return 1
  if (i.phase === 'dusk') return 4
  if (!story) return 11
  if (day && i.needsWeapon === true && finite(i.secondsLeft) < PREPARE_WEAPON_BEFORE_DUSK_S)
    return PREPARE_WEAPON_RULE
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
    case 'workbench':
      return WORKBENCH_POS
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
  if (def.id === 11 && i.story === false) return ENDLESS_DAY_MAIN
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
  if (i.story === false && (def.id === 1 || def.id === 11)) {
    const tail =
      def.id === 1
        ? `Zombies left: ${Math.max(0, Math.floor(finite(i.waves.zombiesLeft)))}`
        : `Dusk in ${formatClock(i.secondsLeft)}`
    return `Night ${Math.max(1, Math.floor(finite(i.nightNumber)))} \u00b7 ${tail}`
  }
  if (def.id === 2) return RITE_SECOND
  if (def.id === 3) return CRANE_SECOND
  // The prepare rule stands above the story objective, which moves down to the second line.
  if (def.id === PREPARE_WEAPON_RULE) {
    const story = ruleDef(matchRule({ ...i, needsWeapon: false }))
    return story.id === 11 && i.stage ? stageCaseLine(i.stage) : mainLine(story, i)
  }
  const t = def.second ?? ''
  return t
    .replace('{k}', String(Math.max(0, Math.floor(finite(i.waves.zombiesLeft)))))
    .replace('{clock}', formatClock(i.secondsLeft))
}

/** Night rule 1 in a story stage: the curse line, the Curse meter and the altar-locked line. */
const curseObjective = (stage: NonNullable<ObjectiveInput['stage']>): Objective => {
  const curse = { value: curseValue(stage.curseLinks), max: CURSE_MAX }
  const locked = finite(stage.altarLockedS) > 0
  return {
    rule: CURSE_RULE.id,
    main: cut(CURSE_RULE.main),
    // Locked: the silence replaces the meter text. Otherwise the HUD draws the meter in this slot.
    second: locked ? cut(ALTAR_LOCKED_LINE.replace('{clock}', formatClock(stage.altarLockedS))) : '',
    position: CHAPEL_ALTAR,
    marker: CURSE_RULE.marker,
    curse,
  }
}

/** Day fallback in a story stage (rule 11): name the case and, when known, the clue count. */
const stageCaseLine = (stage: NonNullable<ObjectiveInput['stage']>): string => {
  const title = STAGE_MAP[stage.stage].caseTitle
  const c = stage.clues
  return c
    ? CASE_SOLVE_LINE.replace('{title}', title).replace('{n}', String(c.found)).replace('{m}', String(c.total))
    : `Solve the case: ${title}`
}

export const selectObjective = (i: ObjectiveInput): Objective => {
  const matched = matchRule(i)
  if (i.stage && matched === 1) return curseObjective(i.stage)
  const def = ruleDef(matched)
  if (i.stage && def.id === 11 && i.story !== false) {
    return {
      rule: 11,
      main: cut(stageCaseLine(i.stage)),
      second: cut(secondLine(def, i)),
    }
  }
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
