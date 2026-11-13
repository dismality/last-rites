// Save shape, sanitising and retry merge for the case store (spec 10 task 2.3, Req 4.1-4.6).
// Pure: no stores, no React. Everything is JSON-safe arrays, so save -> load is the identity.

import { CASES, type CaseId, type MinigameId } from '../../data/cases'
import { DOUBT_MAX } from '../../data/stages'
import type { HintState } from './caseHints'
import type { DoubtState } from './caseScore'
import { linkKey } from './caseBoard'

/** One case's progress. Found clues, links and solved minigames are what Retry keeps. */
export interface CaseProgress {
  found: string[]
  /** `linkKey` pairs the player drew, in order. */
  links: string[]
  /** Minigames solved. */
  minigames: MinigameId[]
  /** Final_Question slots; `null` is empty. */
  slots: (string | null)[]
  /** Wrong answers given (day minigames and the altar); Sharp Eye needs 0. */
  wrongAnswers: number
  hints: HintState
}

export interface CaseSave {
  cases: Record<CaseId, CaseProgress>
  /** Solved cases, in the order they closed. */
  closed: CaseId[]
  doubt: DoubtState
}

export const CASE_PERSISTED = ['cases', 'closed', 'doubt'] as const

export function freshProgress(id: CaseId): CaseProgress {
  const c = CASES.find((x) => x.id === id)
  return {
    found: [],
    links: [],
    minigames: [],
    slots: (c?.final.slots ?? []).map(() => null),
    wrongAnswers: 0,
    hints: { revealed: 0 },
  }
}

export function freshCaseSave(): CaseSave {
  return {
    cases: Object.fromEntries(CASES.map((c) => [c.id, freshProgress(c.id)])) as Record<CaseId, CaseProgress>,
    closed: [],
    doubt: { nightId: 0, doubt: 0 },
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0
const uniq = <T,>(xs: readonly T[]): T[] => Array.from(new Set(xs))

function sanitizeProgress(raw: unknown, id: CaseId): CaseProgress {
  const def = CASES.find((c) => c.id === id)
  const base = freshProgress(id)
  if (!def || !isObj(raw)) return base
  // Stale ids from an older build are dropped, never thrown on (design "Error Handling").
  const clueIds = new Set<string>(def.clues.map((c) => c.id))
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const validLinks = new Set<string>()
  for (const a of def.clues) for (const b of def.clues) if (a.id !== b.id) validLinks.add(linkKey(a.id, b.id))
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : []
  const revealed = count(raw.hints && isObj(raw.hints) ? raw.hints.revealed : 0, 3)
  return {
    found: uniq(strings(raw.found).filter((x) => clueIds.has(x))),
    links: uniq(strings(raw.links).filter((x) => validLinks.has(x))),
    minigames: uniq(strings(raw.minigames).filter((x) => def.minigames.includes(x as MinigameId))) as MinigameId[],
    slots: def.final.slots.map((s, i) => {
      const v = rawSlots[i]
      return typeof v === 'string' && s.options.includes(v) ? v : null
    }),
    wrongAnswers: count(raw.wrongAnswers),
    hints: { revealed: revealed as HintState['revealed'] },
  }
}

/** Reads a saved block; junk gives fresh progress for that part. Never throws. */
export function sanitizeCaseSave(raw: unknown): CaseSave {
  if (!isObj(raw)) return freshCaseSave()
  const rawCases = isObj(raw.cases) ? raw.cases : {}
  const ids = CASES.map((c) => c.id)
  const closed = Array.isArray(raw.closed)
    ? uniq(raw.closed.filter((x): x is CaseId => ids.includes(x as CaseId)))
    : []
  const d = isObj(raw.doubt) ? raw.doubt : {}
  return {
    cases: Object.fromEntries(ids.map((id) => [id, sanitizeProgress(rawCases[id], id)])) as Record<CaseId, CaseProgress>,
    closed,
    doubt: { nightId: count(d.nightId), doubt: count(d.doubt, DOUBT_MAX) },
  }
}

const union = <T,>(first: readonly T[], second: readonly T[]): T[] => uniq([...first, ...second])

/**
 * Retry rule (spec 10 F5, Property 10): found clues, links and solved minigames are the union of
 * the snapshot and what the player has now, so death never costs knowledge. Everything else
 * (slots, wrong answers, hint tiers, Doubt, the closed list) comes back from the snapshot.
 */
export function mergeRetry(snapshot: CaseSave, current: CaseSave): CaseSave {
  const cases = { ...snapshot.cases }
  for (const id of Object.keys(cases) as CaseId[]) {
    const s = snapshot.cases[id]
    const c = current.cases[id]
    cases[id] = {
      ...s,
      found: union(s.found, c.found),
      links: union(s.links, c.links),
      minigames: union(s.minigames, c.minigames),
    }
  }
  return { cases, closed: [...snapshot.closed], doubt: { ...snapshot.doubt } }
}
