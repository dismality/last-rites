// First-day tutorial director (Req 4). Pure: the current step is never stored, it is derived
// as the lowest id not yet done. Any action marks its own step done even when that step is not
// current, which gives "skip if already done", "resume on re-enable" and "never two at once".

import {
  TUTORIAL_GLYPH,
  TUTORIAL_STEPS,
  TUTORIAL_WALK_TARGET_M,
  type TutorialAction,
  type TutorialStepId,
} from '../../data/tutorialSteps'
import type { Phase } from '../types'
import { keyLabel } from './interaction'

// One label helper for the whole game; re-exported so the tutorial API matches the design.
export { keyLabel }

export const currentTutorialStep = (done: ReadonlySet<TutorialStepId>): TutorialStepId | null => {
  for (const s of TUTORIAL_STEPS) if (!done.has(s.id)) return s.id
  return null
}

/** Returns a new set with the step belonging to `action` marked done. */
export const markActionDone = (
  done: ReadonlySet<TutorialStepId>,
  action: TutorialAction,
): ReadonlySet<TutorialStepId> => {
  const step = TUTORIAL_STEPS.find((s) => s.action === action)
  if (!step || done.has(step.id)) return done
  return new Set([...done, step.id])
}

/** Replaces `{Action}` tokens with the label of the bound key and prefixes the glyph. */
export const formatPrompt = (template: string, bindings: Record<string, string>): string => {
  const text = template.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const code = bindings[name]
    return code ? keyLabel(code) : name
  })
  return `${TUTORIAL_GLYPH} ${text}`
}

export interface TutorialPromptContext {
  done: ReadonlySet<TutorialStepId>
  enabled: boolean
  phase: Phase
  nightNumber: number
  bindings: Record<string, string>
}

export const tutorialPrompt = (c: TutorialPromptContext): string | null => {
  // Tutorial belongs to the first day only; night 1 starting retires it for the run.
  if (!c.enabled || c.phase !== 'day' || c.nightNumber !== 1) return null
  const id = currentTutorialStep(c.done)
  if (id === null) return null
  const def = TUTORIAL_STEPS.find((s) => s.id === id)
  return def ? formatPrompt(def.template, c.bindings) : null
}

/** Adds the ground-plane distance from `from` to `to`; bad input leaves the total unchanged. */
export const walkStep = (
  walked: number,
  from: readonly [number, number] | null,
  to: readonly [number, number],
): number => {
  if (from === null) return walked
  const d = Math.hypot(to[0] - from[0], to[1] - from[1])
  return Number.isFinite(d) ? walked + d : walked
}

export const isWalkComplete = (walked: number): boolean => walked >= TUTORIAL_WALK_TARGET_M

export const serializeTutorial = (done: ReadonlySet<TutorialStepId>): number[] =>
  [...done].sort((a, b) => a - b)

/** Junk in, empty (or reduced) set out; never throws. */
export const parseTutorial = (raw: unknown): ReadonlySet<TutorialStepId> => {
  const out = new Set<TutorialStepId>()
  if (!Array.isArray(raw)) return out
  for (const v of raw) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7) {
      out.add(v as TutorialStepId)
    }
  }
  return out
}
