// Name the Dead (spec 10 task 11, Req 28). Pure: which grave glows each wave, whether its name is
// known, and the 3 s hold that seals it (damage cancels the hold). The store and the scene apply it.

import { DEAD_NAMES, type ClueId, type DeadNameDef } from '../../data/cases'
import { NAME_THE_DEAD } from '../../data/nameTheDead'
import type { StageNumber } from '../../data/stages'
import type { WaveGrave } from '../../data/waves'
import { createRng, deriveSeed } from '../rng'

/** Float slack so a hold summed from fixed steps still reaches the full time. */
const HOLD_EPSILON_S = 1e-9

export interface GlowingGrave {
  graveId: string
  name: string
  /** The 0-based wave it glows for. */
  wave: number
}

/** The names a stage's nights may show. */
export function namesForStage(stage: StageNumber): DeadNameDef[] {
  return DEAD_NAMES.filter((n) => n.stage <= stage)
}

/** Req 28.1: the grave that glows this wave, or null before Stage 2. Same seed, same pick. */
export function glowingGrave(
  seed: number,
  stage: StageNumber,
  wave: number,
  graves: readonly WaveGrave[],
): GlowingGrave | null {
  if (stage < NAME_THE_DEAD.fromStage || graves.length === 0) return null
  const names = namesForStage(stage)
  const rng = createRng(deriveSeed(deriveSeed(seed, 'name-the-dead', stage), 'wave', wave))
  const grave = graves[Math.floor(rng() * graves.length)]
  const name = names[Math.floor(rng() * names.length)]
  return { graveId: grave.id, name: name.name, wave }
}

/** A name is known once any clue that names it has been found. */
export function isNameKnown(name: string, found: readonly string[]): boolean {
  const def = DEAD_NAMES.find((n) => n.name === name)
  return def !== undefined && def.clues.some((c: ClueId) => found.includes(c))
}

/** Graves that may still open this wave: a grave sealed for this wave stays shut (Req 28.2). */
export function openGraves(
  graves: readonly WaveGrave[],
  sealed: { graveId: string; wave: number } | null,
  wave: number,
): readonly WaveGrave[] {
  if (sealed === null || sealed.wave !== wave) return graves
  return graves.filter((g) => g.id !== sealed.graveId)
}

export interface NameHold {
  /** The grave being held, or null. */
  target: string | null
  heldS: number
  /** Done (sealed, refused or struck) until Interact is let go. */
  spent: boolean
}

export const createNameHold = (): NameHold => ({ target: null, heldS: 0, spent: false })

export interface NameHoldInput {
  /** Interact is held (and no menu is open). */
  held: boolean
  /** The glowing grave in the crosshair, or null. */
  target: string | null
  /** The grave's name is in the evidence found. */
  known: boolean
  /** The keeper took damage this step. */
  hit: boolean
  holdS?: number
}

export type NameHoldEvent = 'sealed' | 'unknown' | 'struck'

export interface NameHoldTick {
  state: NameHold
  event: NameHoldEvent | null
}

/** One fixed step of the hold. */
export function tickNameHold(s: NameHold, dt: number, i: NameHoldInput): NameHoldTick {
  const holdS = i.holdS ?? NAME_THE_DEAD.holdS
  if (!i.held || i.target === null) return { state: createNameHold(), event: null }
  // A new grave in the crosshair starts afresh.
  const cur = s.target === i.target ? s : { target: i.target, heldS: 0, spent: false }
  if (cur.spent) return { state: cur, event: null }
  if (!i.known) return { state: { ...cur, heldS: 0, spent: true }, event: 'unknown' }
  if (i.hit) return { state: { ...cur, heldS: 0, spent: true }, event: cur.heldS > 0 ? 'struck' : null }
  const heldS = cur.heldS + dt
  if (heldS + HOLD_EPSILON_S >= holdS) return { state: { ...cur, heldS: holdS, spent: true }, event: 'sealed' }
  return { state: { ...cur, heldS }, event: null }
}

/** 0-1 progress of a hold, for the ring. */
export function nameHoldProgress(s: NameHold, holdS: number = NAME_THE_DEAD.holdS): number {
  return s.spent ? 0 : Math.min(1, s.heldS / holdS)
}
