// Save shape, sanitising and retry merge for the case store (spec 10 task 2.3, Req 4.1-4.6).
// Pure: no stores, no React. Everything is JSON-safe arrays, so save -> load is the identity.

import {
  CASES,
  CASE_1_BELLS,
  CASE_1_LEDGER,
  CASE_1_STONES,
  CASE_2_BOOTS,
  CASE_2_FRESH_GRAVES,
  CASE_3_HAND_SAMPLES,
  type BellPostId,
  type BootId,
  type CaseId,
  type HandSampleId,
  type FreshGraveId,
  type LedgerFlagKind,
  type MinigameId,
} from '../../data/cases'
import type { Revealed } from '../../data/zones'
import { DOUBT_MAX } from '../../data/stages'
import type { HintState } from './caseHints'
import type { DoubtState } from './caseScore'
import { linkKey } from './caseBoard'

/** A line drawn on minigame 1a from a stone to a ledger entry; `flag`lag is set once a right flag is accepted. */
export interface LedgerLine {
  stoneId: string
  ledgerId: string
  flag: LedgerFlagKind | null
}

const FLAG_KINDS: readonly LedgerFlagKind[] = ['date', 'plot', 'cause']

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
  /** Minigame 1a draft: lines drawn so far. Kept when the overlay closes (Req 11.7). */
  ledgerLines: LedgerLine[]
  /** Minigame 1b: bell posts fully examined (bell, rope and tag). Kept when the overlay closes. */
  bellsExamined: BellPostId[]
  /** Case 1: the stones read at the graves (stone ids), so the ledger can show what they say. */
  stonesRead: string[]
  /** Case 2: the fresh graves inspected, so the register can show what each one looks like. */
  gravesSeen: FreshGraveId[]
  /** Minigame 2a: register lines marked right (the grave agrees, or the robbed one does not). */
  registerMarked: FreshGraveId[]
  /** Case 2: the print at the robbed grave has been taken into the journal (2c needs it). */
  printTaken: boolean
  /** Minigame 2c: boots held up against the print so far. */
  bootsCompared: BootId[]
  /** Minigame 3a: the five brass tiles as set so far (an A-Z letter or null). Kept when the overlay closes. */
  hymnTiles: (string | null)[]
  /** Minigame 3d: the handwriting samples looked at in the journal. */
  handSeen: HandSampleId[]
}

export const HYMN_TILE_COUNT = 5
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
    ledgerLines: [],
    bellsExamined: [],
    stonesRead: [],
    gravesSeen: [],
    registerMarked: [],
    printTaken: false,
    bootsCompared: [],
    hymnTiles: emptyHymnTiles(),
    handSeen: [],
  }
}

/** Handwriting sample ids from a save: known samples only, no repeats. */
export function sanitizeHandSamples(raw: unknown): HandSampleId[] {
  const ids: readonly string[] = CASE_3_HAND_SAMPLES.map((h) => h.id)
  const list = Array.isArray(raw) ? raw : []
  return Array.from(new Set(list.filter((x): x is HandSampleId => typeof x === 'string' && ids.includes(x))))
}

export function emptyHymnTiles(): (string | null)[] {
  return Array.from({ length: HYMN_TILE_COUNT }, () => null)
}

/** Five slots, each a single A-Z letter or null; anything else becomes an empty tile. */
export function sanitizeHymnTiles(raw: unknown): (string | null)[] {
  const list = Array.isArray(raw) ? raw : []
  return emptyHymnTiles().map((_, i) => {
    const v = list[i]
    return typeof v === 'string' && /^[A-Z]$/.test(v) ? v : null
  })
}

/** Solved cases and solved minigames: what a reward spawn waits for (`FixedSpawn.revealedBy`). */
export function revealedIds(save: Pick<CaseSave, 'cases' | 'closed'>): Revealed[] {
  return [...save.closed, ...Object.values(save.cases).flatMap((p) => p.minigames)]
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

/** Keeps well-formed lines only, one per stone and one per entry; stale ids are dropped. */
export function sanitizeLedgerLines(raw: unknown): LedgerLine[] {
  if (!Array.isArray(raw)) return []
  const out: LedgerLine[] = []
  for (const l of raw) {
    if (!isObj(l) || typeof l.stoneId !== 'string' || typeof l.ledgerId !== 'string') continue
    if (!CASE_1_STONES.some((s) => s.id === l.stoneId) || !CASE_1_LEDGER.some((e) => e.id === l.ledgerId)) continue
    if (out.some((o) => o.stoneId === l.stoneId || o.ledgerId === l.ledgerId)) continue
    const flag = FLAG_KINDS.find((k) => k === l.flag) ?? null
    out.push({ stoneId: l.stoneId, ledgerId: l.ledgerId, flag })
  }
  return out
}

/** Fresh-grave ids from a save: known graves only, no repeats. */
const graveIds = (xs: readonly string[]): FreshGraveId[] =>
  uniq(xs.filter((x) => CASE_2_FRESH_GRAVES.some((g) => g.id === x))) as FreshGraveId[]

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
    ledgerLines: id === 'saved-by-the-bell' ? sanitizeLedgerLines(raw.ledgerLines) : [],
    bellsExamined:
      id === 'saved-by-the-bell'
        ? (uniq(strings(raw.bellsExamined).filter((x) => CASE_1_BELLS.some((b) => b.id === x))) as BellPostId[])
        : [],
    stonesRead:
      id === 'saved-by-the-bell' ? uniq(strings(raw.stonesRead).filter((x) => CASE_1_STONES.some((st) => st.id === x))) : [],
    gravesSeen: id === 'resurrection-men' ? graveIds(strings(raw.gravesSeen)) : [],
    registerMarked: id === 'resurrection-men' ? graveIds(strings(raw.registerMarked)) : [],
    printTaken: id === 'resurrection-men' && raw.printTaken === true,
    bootsCompared:
      id === 'resurrection-men'
        ? (uniq(strings(raw.bootsCompared).filter((x) => CASE_2_BOOTS.some((b) => b.id === x))) as BootId[])
        : [],
    hymnTiles: id === 'sealed-catacombs' ? sanitizeHymnTiles(raw.hymnTiles) : emptyHymnTiles(),
    handSeen: id === 'sealed-catacombs' ? sanitizeHandSamples(raw.handSeen) : [],
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
      // A drawn line is knowledge too; the current draft is never older than the snapshot's.
      ledgerLines: c.ledgerLines.length >= s.ledgerLines.length ? c.ledgerLines : s.ledgerLines,
      // A post already examined stays examined, like a found clue.
      bellsExamined: union(s.bellsExamined, c.bellsExamined),
      stonesRead: union(s.stonesRead, c.stonesRead),
      // Graves seen, lines marked, the print and boots compared are knowledge: kept like clues.
      gravesSeen: union(s.gravesSeen, c.gravesSeen),
      registerMarked: union(s.registerMarked, c.registerMarked),
      printTaken: s.printTaken || c.printTaken,
      bootsCompared: union(s.bootsCompared, c.bootsCompared),
      // Tiles already set stay set: the one with more letters is the newer draft.
      hymnTiles: c.hymnTiles.filter(Boolean).length >= s.hymnTiles.filter(Boolean).length ? c.hymnTiles : s.hymnTiles,
      // A card already examined stays found, like a clue; the draft with more cards is the newer one.
      handSeen: union(s.handSeen, c.handSeen),
    }
  }
  return { cases, closed: [...snapshot.closed], doubt: { ...snapshot.doubt } }
}
