import { STAGE_DAY_RULES } from '../../data/objectiveRules'
import { caseOfStage } from '../../data/cases'
import { describe, expect, it } from 'vitest'
import { CASES } from '../../data/cases'
import { linkKey } from '../../game/systems/caseBoard'
import {
  clueIconUrl,
  curseView,
  hintRows,
  layoutCards,
  linkMessage,
  boardStrings,
  missingCards,
  pickCard,
  questionSegments,
  stringViews,
} from './caseBoardView'

const c1 = CASES[0]

describe('caseBoardView', () => {
  it('picks, deselects and links', () => {
    expect(pickCard(null, 'a')).toEqual({ selected: 'a', link: null })
    expect(pickCard('a', 'a')).toEqual({ selected: null, link: null })
    expect(pickCard('a', 'b')).toEqual({ selected: null, link: { a: 'a', b: 'b' } })
  })

  it('keeps a card in place when others are found', () => {
    const some = layoutCards([c1.clues[2]], c1.clues)[0]
    const more = layoutCards(c1.clues.slice(0, 4), c1.clues).find((c) => c.clue.id === c1.clues[2].id)!
    expect(more.at).toEqual(some.at)
  })

  it('marks right and wrong strings and drops strings to missing cards', () => {
    // Case 1 has no links (its journal asks one question); Case 2 does.
    const c2 = CASES[1]
    const cards = layoutCards(c2.clues, c2.clues)
    const n = c2.notes[0]
    const right = linkKey(n.a, n.b)
    const notes = new Set(c2.notes.map((x) => linkKey(x.a, x.b)))
    const pairs = c2.clues.flatMap((a, i) => c2.clues.slice(i + 1).map((b) => linkKey(a.id, b.id)))
    const wrong = pairs.find((k) => !notes.has(k))!
    const views = stringViews([right, wrong, 'x|y'], c2, cards)
    expect(views.map((v) => v.correct)).toEqual([true, false])
    expect(views[0].path.startsWith('M ')).toBe(true)
  })

  it('words right and wrong links differently', () => {
    const t = (id: string) => id
    expect(linkMessage(t, 'a', 'b', { added: true, note: { text: 'N.' } })).toContain('Right link')
    expect(linkMessage(t, 'a', 'b', { added: true, note: null })).toContain('thread slips')
    expect(linkMessage(t, 'a', 'b', { added: false, note: null }, true)).toContain('tried already')
    expect(linkMessage(t, 'a', 'b', { added: false, note: null })).toContain('already')
  })

  it('splits the final question around its slots', () => {
    const c2 = CASES[1]
    const segs = questionSegments(c2.final)
    expect(segs.filter((s) => s.kind === 'slot').map((s) => s.slot)).toEqual(c2.final.slots.map((_, i) => i))
    // A typed question (Case 1) is all text.
    expect(questionSegments(c1.final).every((s) => s.kind === 'text')).toBe(true)
    expect(segs[0].kind).toBe('text')
  })

  it('prices hints in order and explains a refusal', () => {
    const rows = hintRows(c1, { revealed: 0 }, 3, 0, true)
    expect(rows.map((r) => r.state)).toEqual(['next', 'locked', 'locked'])
    expect(rows[0].label).toContain('5 Grave Coins')
    expect(rows[0].canBuy).toBe(false)
    expect(rows[0].why).toContain('5')
    const after = hintRows(c1, { revealed: 1 }, 10, 0, true)
    expect(after[0].text).toBe(c1.hints[0].text)
    expect(after[1].canBuy).toBe(true)
  })

  it('shows tier 3 as free once the night has run long in Story', () => {
    const rows = hintRows(c1, { revealed: 2 }, 0, 999, true)
    expect(rows[2].label).toContain('free')
    expect(rows[2].canBuy).toBe(true)
  })

  it('reports the curse as a number and a fraction', () => {
    const c2 = CASES[1]
    const n = c2.notes[0]
    expect(curseView([], c2)).toEqual({ label: `Curse ${c2.curseSteps} / ${c2.curseSteps}`, fraction: 1 })
    expect(curseView([linkKey(n.a, n.b)], c2).label).toBe(`Curse ${c2.curseSteps - 1} / ${c2.curseSteps}`)
  })

  it('gives every clue of every case an icon url', () => {
    for (const c of CASES) for (const k of c.clues) expect(clueIconUrl(k.icon)).toMatch(/^\/assets\/icons\//)
  })

  it('draws right strings always, and a wrong one only while it falls', () => {
    const v = (key: string, correct: boolean) => ({ key, a: 'a', b: 'b', correct, path: '', mid: { x: 0, y: 0 } })
    const all = [v('r', true), v('w1', false), v('w2', false)]
    expect(boardStrings(all, null).map((s) => s.key)).toEqual(['r'])
    expect(boardStrings(all, 'w2').map((s) => s.key)).toEqual(['r', 'w2'])
  })

  it('lays a face-down card for each clue not found, saying where to look', () => {
    const def = caseOfStage(1)
    const found = new Set([def.clues[0].id])
    const backs = missingCards(def.clues, found, STAGE_DAY_RULES[1])
    expect(backs.map((b) => b.id)).toEqual(def.clues.slice(1).map((c) => c.id))
    for (const b of backs) expect(b.where.length).toBeGreaterThan(0)
    // A walk clue names its zone and pins near it, never on the spot itself.
    const walk = def.clues.find((c) => c.found.kind === 'walk' && !found.has(c.id))
    if (walk && walk.found.kind === 'walk') {
      const b = backs.find((x) => x.id === walk.id)!
      expect(b.where).toMatch(/^Somewhere in /)
      expect(b.pin).toBeDefined()
      expect(Math.hypot(b.pin!.x - walk.found.position[0], b.pin!.z - walk.found.position[2])).toBeGreaterThan(1)
    }
    // Every clue found: no face-down cards.
    expect(missingCards(def.clues, new Set(def.clues.map((c) => c.id)), STAGE_DAY_RULES[1])).toEqual([])
  })
})
