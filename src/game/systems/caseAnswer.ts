// Final-question checks (spec 10 task 2.2, Req 8.8). Pure comparison with the case data.
// The verdict feeds `giveAnswer` in altarAnswer.ts as its injected `correct` flag.

import type { CaseDef, FinalQuestionDef } from '../../data/cases'

/** One chosen option per slot; `null` is an empty slot. */
export type SlotAnswer = readonly (string | null)[]

function matches(q: FinalQuestionDef, answer: SlotAnswer): boolean {
  return answer.length === q.answer.length && q.answer.every((want, i) => answer[i] === want)
}

/**
 * A typed answer reduced for comparison: lower case, `&` read as "and", a leading "the" or "mr"
 * ignored, then only letters and digits kept. "J. Vane", "j vane" and "JVane" are the same, and so
 * are "J.V." and "jv".
 */
export function normalizeAnswer(text: string): string {
  const words = text.toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter(Boolean)
  while (words.length > 1 && (words[0] === 'the' || words[0] === 'mr')) words.shift()
  return words.join('')
}

/** A typed answer is right when it reads as any accepted form. False for a question that is not typed. */
export function checkTypedAnswer(q: FinalQuestionDef, text: string): boolean {
  if (!q.typed) return false
  const said = normalizeAnswer(text)
  return said !== '' && q.typed.accept.some((a) => normalizeAnswer(a) === said)
}

/**
 * True only when every slot holds the data's right option. Empty or extra slots are wrong. A typed
 * question is checked against `typed` instead.
 */
export function checkFinalAnswer(c: CaseDef, answer: SlotAnswer, typed = ''): boolean {
  if (c.final.typed) return checkTypedAnswer(c.final, typed)
  return matches(c.final, answer)
}

/** The Stage 3 accusation. A case without one never accepts; a typed one is checked as typed. */
export function checkAccusation(c: CaseDef, answer: SlotAnswer, typed = ''): boolean {
  if (c.accusation?.typed) return checkTypedAnswer(c.accusation, typed)
  return c.accusation !== undefined && matches(c.accusation, answer)
}

/**
 * The reply for a typed answer that is neither right nor wrong (a bare "Vane" when the question
 * wants one Vane), or null. The altar asks again and counts nothing.
 */
export function typedAskReply(q: FinalQuestionDef, text: string): string | null {
  const said = normalizeAnswer(text)
  if (!q.typed?.ask || said === '') return null
  return q.typed.ask.forms.some((f) => normalizeAnswer(f) === said) ? q.typed.ask.reply : null
}

/** True when every slot has a choice, so the player may give the answer. */
export function isAnswerComplete(q: FinalQuestionDef, answer: SlotAnswer, typed = ''): boolean {
  if (q.typed) return normalizeAnswer(typed) !== ''
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
