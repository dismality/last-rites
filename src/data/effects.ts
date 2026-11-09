// Timed effects mirrored from docs/game-design.md §4 "Timed effects (07)".
import type { EffectId } from '../game/types'

export interface EffectDef {
  id: EffectId
  name: string
  durationS: number
  /** Shape cue so the effect is never shown by colour alone. */
  glyph: string
  mods: { firearmDamage?: number; moveSpeed?: number; sprintDrain?: number }
}

export const EFFECTS: readonly EffectDef[] = [
  { id: 'blessed-rounds', name: 'Blessed Rounds', durationS: 30, glyph: '✝', mods: { firearmDamage: 2 } },
  { id: 'adrenaline', name: 'Adrenaline', durationS: 20, glyph: '⚡', mods: { moveSpeed: 1.3, sprintDrain: 0.5 } },
  { id: 'salt-circle', name: 'Salt Circle', durationS: 30, glyph: '◎', mods: {} },
]

export const EFFECT_MAP: Readonly<Record<EffectId, EffectDef>> = {
  'blessed-rounds': EFFECTS[0],
  adrenaline: EFFECTS[1],
  'salt-circle': EFFECTS[2],
}

/** At most this many effect icons are shown. */
export const MAX_SHOWN_EFFECTS = 6
