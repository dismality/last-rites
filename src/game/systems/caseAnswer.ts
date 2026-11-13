// Final-question checks (spec 10 task 2.2, Req 8.8). Pure comparison with the case data.
// The verdict feeds `giveAnswer` in altarAnswer.ts as its injected `correct` flag.

import type { CaseDef, FinalQuestionDef } from '../../data/cases'

/** One chosen option per slot; `null` is an empty slot. */
export type SlotAnswer = readonly (string | null)[]

function matches(q: FinalQuestionDef, answer: SlotAnswer): boolean {
  return answer.length === q.answer.length && q.answer.every((want, i) => answer[i] === want)
}

/** True only when every slot holds the data's right option. Empty or extra slots are wrong. */
export function checkFinalAnswer(c: CaseDef, answer: SlotAnswer): boolean {
  return matches(c.final, answer)
}

/** The optional Stage 3 accusation. A case without one never accepts. */
export function checkAccusation(c: CaseDef, answer: SlotAnswer): boolean {
  return c.accusation !== undefined && matches(c.accusation, answer)
}

/** True when every slot has a choice, so the player may give the answer. */
export function isAnswerComplete(q: FinalQuestionDef, answer: SlotAnswer): boolean {
  return answer.length === q.slots.length && answer.every((a) => a !== null)
}

/** Replace one slot's choice. Out-of-range slots and options the slot does not offer change nothing. */
export function fillSlot(
  q: FinalQuestionDef,
  answer: SlotAnswer,
  slot: number,
  option: string | null,
): SlotAnswer {
  const def = q.slots[slot]
  if (!def || (option !== null && !def.options.includes(option))) return answer
  const next: (string | null)[] = q.slots.map((_, i) => answer[i] ?? null)
  next[slot] = option
  return next
}
