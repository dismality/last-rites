// Pure view rules for minigame 3b, Elias's Last Night (spec 10 task 4.4, Req 16). The verdict
// itself is `evidenceTimeline` in caseMinigames.ts; this file decides which cards the player holds,
// how the arrangement on the slate changes, and what the keyboard does: arrows choose a card,
// Space lifts it, arrows move it, Enter confirms. No React, three.js or Howler imports.

import { CASE_3_CARD_SHELF, CASE_3_EVIDENCE, CASE_3_TIMELINE_ORDER, type EvidenceCardId } from '../../data/cases'

export type CardOrder = readonly EvidenceCardId[]

const CARD_COUNT = CASE_3_EVIDENCE.length

/** Cards the player has in hand: the ones examined in the world, in the slate's shelf order. */
export function heldCards(found: readonly EvidenceCardId[], bootsClueFound: boolean): EvidenceCardId[] {
  const held = new Set(found)
  if (bootsClueFound) held.add('dry-boots')
  return CASE_3_CARD_SHELF.filter((id) => held.has(id))
}

/**
 * Keeps the arrangement the player made, drops cards no longer held and puts newly found cards at
 * the front in shelf order. Putting them in front (not at the end) means walking the evidence in
 * the right order does not hand over the right arrangement.
 */
export function syncTimeline(order: CardOrder, held: readonly EvidenceCardId[]): EvidenceCardId[] {
  const kept = order.filter((id, i) => held.includes(id) && order.indexOf(id) === i)
  const fresh = held.filter((id) => !kept.includes(id))
  return [...fresh, ...kept]
}

/** Moves the card at `from` so it sits at `to` (a copy; out of range leaves the order alone). */
export function moveCard(order: CardOrder, from: number, to: number): EvidenceCardId[] {
  const next = [...order]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [card] = next.splice(from, 1)
  next.splice(to, 0, card)
  return next
}

export interface TimelineKeyState {
  cursor: number
  lifted: boolean
  order: EvidenceCardId[]
}

export type TimelineKeyResult = TimelineKeyState & { confirm: boolean }

/**
 * One key press. Left and Right choose a card, or carry the lifted card one place; Space lifts and
 * puts down; Enter asks to confirm. A carried card stops at the ends of the slate.
 */
export function timelineKey(state: TimelineKeyState, code: string): TimelineKeyResult {
  const last = state.order.length - 1
  if (code === 'Enter') return { ...state, confirm: true }
  if (code === 'Space') return { ...state, lifted: state.order.length > 0 ? !state.lifted : false, confirm: false }
  const step = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0
  if (step === 0 || last < 0) return { ...state, confirm: false }
  const target = Math.min(last, Math.max(0, state.cursor + step))
  if (!state.lifted) return { ...state, cursor: target, confirm: false }
  return { cursor: target, lifted: true, order: moveCard(state.order, state.cursor, target), confirm: false }
}

/** All six cards are needed before the order can be judged. */
export function timelineReady(order: CardOrder): boolean {
  return order.length === CARD_COUNT
}

/** The card sitting at a position the verdict called wrong, if there is one. */
export function cardAt(order: CardOrder, index: number | undefined): EvidenceCardId | null {
  return index !== undefined && index >= 0 && index < order.length ? order[index] : null
}

/** The night as it happened, one captioned beat per card, earliest first (Req 16.2). */
export function replayBeats(): string[] {
  return CASE_3_TIMELINE_ORDER.map((id) => CASE_3_EVIDENCE.find((e) => e.id === id)!.beat)
}
