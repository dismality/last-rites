// Hint tiers (spec 10 task 2.2, Req 9.1-9.3, 9.9). Pure: tiers reveal strictly in order,
// cost 5, 10 and 20 Grave Coins, and a refusal never takes coins.

import { HINT_COSTS, type CaseDef } from '../../data/cases'

/** Tier 3 is free in Story modes once the night has run this long (Req 9.3). */
export const FREE_TIER3_AFTER_S = 180

export interface HintState {
  /** Tiers revealed so far: tiers 1..revealed. */
  revealed: 0 | 1 | 2 | 3
}

export const INITIAL_HINTS: HintState = { revealed: 0 }

export type HintResult =
  | { kind: 'revealed'; state: HintState; tier: 1 | 2 | 3; cost: number }
  | { kind: 'refused'; reason: 'no-coins' | 'all-revealed'; cost: number }

/** What the next tier would cost now (0 when tier 3 is free, 0 when none is left). */
export function nextHintCost(
  h: HintState,
  nightSeconds: number,
  storyMode: boolean,
): number {
  if (h.revealed >= 3) return 0
  const tier = h.revealed + 1
  if (tier === 3 && storyMode && nightSeconds >= FREE_TIER3_AFTER_S) return 0
  return HINT_COSTS[tier - 1]
}

/** Ask for the next tier. The caller subtracts `cost` from the coins on `revealed`. */
export function nextHint(
  h: HintState,
  coins: number,
  nightSeconds: number,
  storyMode: boolean,
): HintResult {
  if (h.revealed >= 3) return { kind: 'refused', reason: 'all-revealed', cost: 0 }
  const cost = nextHintCost(h, nightSeconds, storyMode)
  if (!Number.isFinite(coins) || coins < cost) return { kind: 'refused', reason: 'no-coins', cost }
  const tier = (h.revealed + 1) as 1 | 2 | 3
  return { kind: 'revealed', state: { revealed: tier }, tier, cost }
}

/** The text of every revealed tier, in order. */
export function revealedHints(c: CaseDef, h: HintState): string[] {
  return c.hints.slice(0, h.revealed).map((t) => t.text)
}
