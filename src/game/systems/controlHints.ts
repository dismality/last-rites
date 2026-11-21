// Controls hint panel rules (design bible §11). Pure TS: which lines show, what each key cap
// reads, and when an action clears its line. Stores and the HUD only call these.

import {
  CHARGE_WEAPONS,
  CONTROL_HINTS,
  CONTROL_HINT_IDS,
  KEY_NAMES,
  type ControlHintGroup,
  type ControlHintId,
} from '../../data/controlHints'
import { keyLabel } from './interaction'

export interface HintProgress {
  /** Metres moved on the ground plane since the lines (re)started. */
  moved: number
  /** Seconds sprinted since the lines (re)started. */
  sprinted: number
  /** Screen pixels the mouse has turned the view since the lines (re)started. */
  looked: number
}

export const freshHintProgress = (): HintProgress => ({ moved: 0, sprinted: 0, looked: 0 })

/** A single step longer than this is a teleport (load, retry), not walking. */
export const MAX_STEP_M = 0.5

/** "ShiftLeft" -> "Shift", "Mouse2" -> "Mouse 2", "MouseRight" -> "Mouse 2". Never throws. */
export function hintKeyLabel(code: string | undefined): string {
  if (!code) return '?'
  const named = KEY_NAMES[code]
  if (named) return named
  const mouse = /^Mouse(\d+)$/.exec(code)
  if (mouse) return `Mouse ${mouse[1]}`
  return keyLabel(code)
}

export const isChargeWeapon = (id: string | null | undefined): boolean =>
  id !== null && id !== undefined && CHARGE_WEAPONS.includes(id)

export interface HintLine {
  id: ControlHintId
  prefix: string
  keys: string[]
  word: string
}

export interface HintContext {
  /** The "Show control hints" setting. */
  enabled: boolean
  used: ReadonlySet<ControlHintId>
  bindings: Readonly<Record<string, string>>
  /** Item in the active hotbar slot, or null. */
  heldItem: string | null
  /** Dusk or night: the fighting lines replace the `next` ones. Absent means day. */
  night?: boolean
}

/** True once every line of the group has been used. */
const groupDone = (group: ControlHintGroup, used: ReadonlySet<ControlHintId>): boolean =>
  CONTROL_HINTS.every((d) => d.group !== group || used.has(d.id))

/** Whether a group's lines may show now: start first, then next by day or night by dark. */
function groupOpen(group: ControlHintGroup, c: HintContext): boolean {
  if (group === 'weapon') return true
  if (group === 'start') return true
  if (!groupDone('start', c.used)) return false
  return group === 'night' ? c.night === true : c.night !== true
}

/** The lines to draw now, in panel order. Empty when the setting is off or everything is cleared. */
export function hintLines(c: HintContext): HintLine[] {
  if (!c.enabled) return []
  const lines: HintLine[] = []
  for (const def of CONTROL_HINTS) {
    if (c.used.has(def.id)) continue
    if (!groupOpen(def.group, c)) continue
    if (def.needsHeavyWeapon && !isChargeWeapon(c.heldItem)) continue
    lines.push({
      id: def.id,
      prefix: def.prefix ?? '',
      keys: def.fixedKeys ? [...def.fixedKeys] : def.actions.map((a) => hintKeyLabel(c.bindings[a])),
      word: def.word,
    })
  }
  return lines
}

export const markHintUsed = (
  used: ReadonlySet<ControlHintId>,
  id: ControlHintId,
): ReadonlySet<ControlHintId> => (used.has(id) ? used : new Set([...used, id]))

export interface HintStep {
  /** Ground distance covered this step, metres. */
  moved: number
  dt: number
  /** Shift held, moving, and stamina left. */
  sprinting: boolean
  /** Screen pixels the mouse turned the view this step. */
  looked?: number
}

/** Adds one step to the progress and returns the lines that just cleared. */
export function advanceHints(
  progress: HintProgress,
  used: ReadonlySet<ControlHintId>,
  step: HintStep,
): { progress: HintProgress; used: ReadonlySet<ControlHintId> } {
  const moved = step.moved > 0 && step.moved <= MAX_STEP_M ? step.moved : 0
  const next: HintProgress = {
    moved: progress.moved + moved,
    sprinted: progress.sprinted + (step.sprinting && step.dt > 0 ? step.dt : 0),
    looked: progress.looked + (step.looked !== undefined && step.looked > 0 && Number.isFinite(step.looked) ? step.looked : 0),
  }
  let out = used
  for (const def of CONTROL_HINTS) {
    if (def.clear.kind === 'distance' && next.moved >= def.clear.metres) out = markHintUsed(out, def.id)
    if (def.clear.kind === 'sprint' && next.sprinted >= def.clear.seconds - 1e-6) out = markHintUsed(out, def.id)
    if (def.clear.kind === 'look' && next.looked >= def.clear.pixels) out = markHintUsed(out, def.id)
  }
  return { progress: next, used: out }
}

/** The binding actions bound to a key or mouse code. */
export const actionsForCode = (bindings: Readonly<Record<string, string>>, code: string): string[] =>
  Object.keys(bindings).filter((a) => bindings[a] === code)

/** A binding action was pressed: clears every line that waits for that press. */
export function markPressed(used: ReadonlySet<ControlHintId>, action: string): ReadonlySet<ControlHintId> {
  let out = used
  for (const def of CONTROL_HINTS) {
    if (def.clear.kind === 'press' && def.clear.actions.includes(action)) out = markHintUsed(out, def.id)
  }
  return out
}

export const serializeHintsUsed = (used: ReadonlySet<ControlHintId>): ControlHintId[] =>
  CONTROL_HINT_IDS.filter((id) => used.has(id))

/** Junk in, empty (or reduced) set out; never throws. */
export function parseHintsUsed(raw: unknown): ReadonlySet<ControlHintId> {
  const out = new Set<ControlHintId>()
  if (!Array.isArray(raw)) return out
  for (const v of raw) if (typeof v === 'string' && (CONTROL_HINT_IDS as readonly string[]).includes(v)) out.add(v as ControlHintId)
  return out
}

/** Every hidden-by-state check in one place: menus, workbench, big map, examine, cutscenes, endings. */
export interface HintHideContext {
  screen: string
  cinematic: boolean
  menuOpen: boolean
  workbenchOpen: boolean
  mapOpen: boolean
  examining: boolean
}

export const hintsHidden = (c: HintHideContext): boolean =>
  c.screen !== 'game' || c.cinematic || c.menuOpen || c.workbenchOpen || c.mapOpen || c.examining
