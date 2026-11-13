// View model of the altar answer panel (spec 10 task 2.5, Req 3). Pure: it asks the same
// `giveAnswer` rule the store uses, with the answer assumed right, so the panel can say what the
// altar will do before the player presses Answer and the two can never disagree.

import { giveAnswer, type AltarState, type AltarVerdict } from '../../game/systems/altarAnswer'
import type { Phase } from '../../game/types'

export type AltarStatus =
  | { kind: 'day'; text: string }
  | { kind: 'locked'; secondsLeft: number; text: string }
  | { kind: 'needs-link'; text: string }
  | { kind: 'ready'; text: string }

/** "0:24" for a number of seconds. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const DAY_MESSAGE = 'The curse does not stir by day. Answers are given at the altar, at night.'
export const EARLY_MESSAGE = 'The altar answers only at night. Wait for the bell, then come back.'
export const LINK_MESSAGE =
  'The altar wants more than a guess. Link one more clue on the case board (Journal, Case tab), then answer again.'
export const READY_MESSAGE = 'Check each blank, then give your answer. A wrong one wakes the dead.'

export function altarStatus(altar: AltarState, now: number, phase: Phase, links: number): AltarStatus {
  const v = giveAnswer(altar, now, phase, links, true, 'case')
  switch (v.kind) {
    case 'day':
      return { kind: 'day', text: phase === 'day' ? DAY_MESSAGE : EARLY_MESSAGE }
    case 'locked':
      return { kind: 'locked', secondsLeft: v.secondsLeft, text: `The altar is silent: ${clock(v.secondsLeft)}` }
    case 'needs-link':
      return { kind: 'needs-link', text: LINK_MESSAGE }
    default:
      return { kind: 'ready', text: READY_MESSAGE }
  }
}

/** Words for what just happened after Answer, or null when the panel should simply close. */
export function verdictMessage(v: AltarVerdict | { kind: 'incomplete' }): string | null {
  switch (v.kind) {
    case 'incomplete':
      return 'Fill every blank before you answer.'
    case 'solved':
      return null
    case 'wrong':
      return 'A sour note. The dead are rising and the altar is silent for 30 seconds.'
    case 'wrong-accusation':
      return 'The accusation rings false, but nothing stirs.'
    case 'locked':
      return `The altar is silent: ${clock(v.secondsLeft)}`
    case 'needs-link':
      return LINK_MESSAGE
    case 'day':
      return DAY_MESSAGE
  }
}
