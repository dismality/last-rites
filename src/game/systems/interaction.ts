// Pure interaction rules: prompt text, pulse gating, hover targeting.

import { INTERACT_RANGE_M } from '../../data/balance'
import { lanternRadius } from './lantern'

export type InteractAction = 'pickup' | 'dig' | 'open' | 'read' | 'examine' | 'nail'

/** Verb shown in the prompt for each action. */
export const ACTION_LABEL: Record<InteractAction, string> = {
  pickup: 'Take',
  dig: 'Dig',
  open: 'Open',
  read: 'Read',
  examine: 'Examine',
  nail: 'Board up',
}

/**
 * Rune glyph per action. The glyph is the shape cue that accompanies the glow,
 * so highlights never rely on colour alone (Req 1.4).
 */
export const ACTION_RUNE: Record<InteractAction, string> = {
  pickup: 'ᚦ',
  dig: 'ᛉ',
  open: 'ᚨ',
  read: 'ᚱ',
  examine: 'ᛟ',
  nail: 'ᚾ',
}

/** "KeyE" -> "E", "ShiftLeft" -> "Shift", "Digit1" -> "1", "MouseLeft" -> "LMB". */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'MouseLeft') return 'LMB'
  if (code === 'MouseRight') return 'RMB'
  return code.replace(/(Left|Right)$/, '')
}

/** Prompt such as "E: Dig". */
export function promptText(action: InteractAction, keyCode: string): string {
  return `${keyLabel(keyCode)}: ${ACTION_LABEL[action]}`
}

/** Req 1.1: the faint pulse shows only for objects inside the lantern's light. */
export function isWithinLantern(distance: number, fuel: number, lanternOn: boolean): boolean {
  if (!lanternOn) return false
  return distance <= lanternRadius(fuel)
}

/** Req 1.2: hover needs the crosshair on the object and it within reach. */
export function isInteractRange(distance: number): boolean {
  return distance <= INTERACT_RANGE_M
}

export interface HoverCandidate {
  id: string
  distance: number
}

/** Nearest in-range hit from raycast results (already crosshair-aligned), or null. */
export function pickHoverTarget(hits: readonly HoverCandidate[]): HoverCandidate | null {
  let best: HoverCandidate | null = null
  for (const h of hits) {
    if (!isInteractRange(h.distance)) continue
    if (best === null || h.distance < best.distance) best = h
  }
  return best
}
