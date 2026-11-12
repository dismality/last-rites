// One pure rule for every interaction cue (prompt, outline, rune, pulse, hand crosshair):
// a cue shows only when pressing Interact right now would do something. The per-kind wording and
// category come from data/interactables.ts; the facts come from the stores (state/cueFacts.ts).

import { CUE_FADE_S, CUE_FLICKER, INTERACTABLES, type InteractableKind } from '../../data/interactables'
import { ACTION_LABEL, keyLabel } from './interaction'

/** What the game says about one interactable right now. */
export interface CueFacts {
  /** Already used (taken, dug today, examined, opened, sold out). */
  usedUp: boolean
  /** What the player lacks ("a shovel in hand"), or null/undefined when nothing blocks the action. */
  need?: string | null
  /** Repeatable only: nothing new to do right now (stone already read, door full). */
  idle?: boolean
}

export interface CueSettings {
  /** Binding code of the Interact action, e.g. 'KeyE'. */
  keyCode: string
  flashingLights: boolean
}

export interface InteractionCue {
  /** The interaction raycast may select it. False once used up. */
  targetable: boolean
  /** Pressing Interact starts the action. False for needs / idle prompts. */
  actionable: boolean
  /** Prompt text, or null when nothing should show. Never "Hold"/"Press" unless actionable. */
  prompt: string | null
  /** The rune's attract pulse runs. */
  pulse: boolean
  /** Present once used up: the cues fade out over this long. */
  fade: { durationS: number; steady: boolean } | null
}

const USED_UP_BASE = { targetable: false, actionable: false, prompt: null, pulse: false } as const

/** Cue for `kind` given the live facts. Total over every kind and fact combination. */
export function interactionCue(
  kind: InteractableKind,
  facts: CueFacts,
  settings: CueSettings,
): InteractionCue {
  const def = INTERACTABLES[kind]
  if (facts.usedUp) {
    return { ...USED_UP_BASE, fade: { durationS: CUE_FADE_S, steady: !settings.flashingLights } }
  }
  if (facts.need && def.needs) {
    return {
      targetable: true,
      actionable: false,
      prompt: def.needs.prompt.replace('{need}', facts.need),
      pulse: true,
      fade: null,
    }
  }
  if (facts.idle && def.idlePrompt) {
    return { targetable: true, actionable: false, prompt: def.idlePrompt, pulse: false, fade: null }
  }
  const verb = ACTION_LABEL[def.action]
  const base = `${keyLabel(settings.keyCode)}: ${verb}`
  return {
    targetable: true,
    actionable: true,
    prompt: def.hold ? `Hold ${base}` : base,
    // A repeatable thing with nothing new keeps its prompt but stops calling for attention.
    pulse: !facts.idle,
    fade: null,
  }
}

/**
 * Opacity multiplier `elapsedS` after a cue starts fading. Linear and non-increasing; with
 * Flashing lights on, a small guttering ripple rides on top (never raising it above 1).
 */
export function fadeAlpha(elapsedS: number, durationS: number, steady: boolean): number {
  if (elapsedS <= 0) return 1
  if (elapsedS >= durationS) return 0
  const linear = 1 - elapsedS / durationS
  return steady
    ? linear
    : linear * (CUE_FLICKER.floor + CUE_FLICKER.depth * Math.sin(elapsedS * CUE_FLICKER.rateRadPerS))
}
