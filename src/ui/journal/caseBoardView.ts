// Pure view model for the journal's Case tab (spec 10 task 2.4). The components only draw what
// this returns and call store actions; no game rule lives here (the rules are the case systems).
import { iconUrl, type InteractRuneId, type MarkId } from '../../data/assets'
import type { CaseDef, ClueDef, ClueIcon, FinalQuestionDef } from '../../data/cases'
import { correctLinkCount, linkKey } from '../../game/systems/caseBoard'
import { nextHintCost, type HintState } from '../../game/systems/caseHints'

const RUNES: readonly string[] = ['pickup', 'dig', 'open', 'read', 'examine', 'nail', 'trade']

/** Card icon: interaction runes and map marks share one id space in the case data. */
export function clueIconUrl(icon: ClueIcon): string {
  return RUNES.includes(icon)
    ? iconUrl('interact-rune', icon as InteractRuneId)
    : iconUrl('mark-dark', icon as MarkId)
}

/** Board coordinates are 0..100 on both axes. */
export interface Pt {
  x: number
  y: number
}

const COLUMNS = 4
/** A little hand-pinned tilt per card; fixed so the board never reshuffles. */
const TILTS = [-1.6, 1.2, -0.8, 1.8, 0.9, -1.4, 1.5, -1] as const

export interface CardView {
  clue: ClueDef
  /** Card centre in board percent. */
  at: Pt
  tiltDeg: number
}

/** Cards in clue order, laid out on a fixed grid so a card never moves when another is found. */
export function layoutCards(clues: readonly ClueDef[], all: readonly ClueDef[]): CardView[] {
  return clues.map((clue) => {
    const i = Math.max(0, all.findIndex((c) => c.id === clue.id))
    const col = i % COLUMNS
    const row = Math.floor(i / COLUMNS)
    return {
      clue,
      at: { x: 12.5 + col * 25, y: 25 + row * 50 },
      tiltDeg: TILTS[i % TILTS.length],
    }
  })
}

export interface StringView {
  key: string
  a: string
  b: string
  correct: boolean
  /** SVG path in board percent, sagging a little like a real string. */
  path: string
  /** Where the ✓ / ✗ tag sits. */
  mid: Pt
}

/** A string sags toward the bottom of the board by a fraction of its length. */
export function stringPath(a: Pt, b: Pt): { path: string; mid: Pt } {
  const mx = (a.x + b.x) / 2
  const sag = Math.hypot(b.x - a.x, b.y - a.y) * 0.12
  const my = (a.y + b.y) / 2 + sag
  return {
    path: `M ${a.x} ${a.y} Q ${mx} ${my + sag} ${b.x} ${b.y}`,
    // Midpoint of a quadratic curve with control at `my + sag` is (a + 2c + b) / 4.
    mid: { x: mx, y: (a.y + 2 * (my + sag) + b.y) / 4 },
  }
}

/** Drawn strings: only links whose two cards are both on the board are shown. */
export function stringViews(links: readonly string[], caseDef: CaseDef, cards: readonly CardView[]): StringView[] {
  const good = new Set(caseDef.notes.map((n) => linkKey(n.a, n.b)))
  const at = new Map<string, Pt>(cards.map((c) => [c.clue.id, c.at]))
  return links.flatMap((key) => {
    const [a, b] = key.split('|')
    const pa = at.get(a)
    const pb = at.get(b)
    if (!pa || !pb) return []
    return [{ key, a, b, correct: good.has(key), ...stringPath(pa, pb) }]
  })
}

/** What picking a card does, given the one already selected (mouse click and keyboard share it). */
export type PickResult =
  | { selected: string | null; link: null }
  | { selected: null; link: { a: string; b: string } }

export function pickCard(selected: string | null, id: string): PickResult {
  if (selected === null) return { selected: id, link: null }
  if (selected === id) return { selected: null, link: null }
  return { selected: null, link: { a: selected, b: id } }
}

/** Text for the live region after a link attempt. Wrong and right differ in words, not only colour. */
export function linkMessage(
  titleOf: (id: string) => string,
  a: string,
  b: string,
  r: { added: boolean; note: { text: string } | null },
): string {
  const pair = `${titleOf(a)} and ${titleOf(b)}`
  if (!r.added) return `${pair} are already joined.`
  if (r.note) return `Right link: ${pair}. ${r.note.text}`
  return `Dashed string: ${pair}. Nothing connects them yet.`
}

export interface Segment {
  kind: 'text' | 'slot'
  text?: string
  slot?: number
}

/** Split the Final_Question template at its `{n}` markers. */
export function questionSegments(q: FinalQuestionDef): Segment[] {
  const out: Segment[] = []
  for (const part of q.template.split(/(\{\d+\})/)) {
    const m = /^\{(\d+)\}$/.exec(part)
    if (m) out.push({ kind: 'slot', slot: Number(m[1]) })
    else if (part) out.push({ kind: 'text', text: part })
  }
  return out
}

export interface HintRow {
  tier: 1 | 2 | 3
  state: 'revealed' | 'next' | 'locked'
  text: string | null
  cost: number
  /** Whole sentence for the button, so the price is text and never colour alone. */
  label: string
  canBuy: boolean
  /** Why the button is off, when it is. */
  why: string | null
}

export function hintRows(
  def: CaseDef,
  hints: HintState,
  coins: number,
  nightSeconds: number,
  story: boolean,
): HintRow[] {
  const nextCost = nextHintCost(hints, nightSeconds, story)
  return def.hints.map((h, i) => {
    const tier = (i + 1) as 1 | 2 | 3
    if (tier <= hints.revealed) {
      return { tier, state: 'revealed', text: h.text, cost: h.cost, label: `Hint ${tier}`, canBuy: false, why: null }
    }
    if (tier === hints.revealed + 1) {
      const canBuy = coins >= nextCost
      return {
        tier,
        state: 'next',
        text: null,
        cost: nextCost,
        label: nextCost === 0 ? `Reveal hint ${tier} (free)` : `Reveal hint ${tier} (${nextCost} Grave Coins)`,
        canBuy,
        why: canBuy ? null : `Needs ${nextCost} Grave Coins, you have ${coins}.`,
      }
    }
    return {
      tier,
      state: 'locked',
      text: null,
      cost: h.cost,
      label: `Hint ${tier} (${h.cost} Grave Coins)`,
      canBuy: false,
      why: `Reveal hint ${tier - 1} first.`,
    }
  })
}

/** Curse meter as text and bar fraction (Req 8.9: a number plus a bar). */
export function curseView(links: readonly string[], caseDef: CaseDef): { label: string; fraction: number } {
  const max = caseDef.curseSteps
  const value = Math.max(0, max - correctLinkCount({ links }, caseDef))
  return { label: `Curse ${value} / ${max}`, fraction: max > 0 ? value / max : 0 }
}
