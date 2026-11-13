import { describe, expect, it } from 'vitest'
import { CASES } from '../../data/cases'
import { linkKey } from '../../game/systems/caseBoard'
import {
  clueIconUrl,
  curseView,
  hintRows,
  layoutCards,
  linkMessage,
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
    const cards = layoutCards(c1.clues, c1.clues)
    const n = c1.notes[0]
    const right = linkKey(n.a, n.b)
    const wrong = linkKey('hale-fresh-flowers', 'marsh-stone-toppled')
    const views = stringViews([right, wrong, 'x|y'], c1, cards)
    expect(views.map((v) => v.correct)).toEqual([true, false])
    expect(views[0].path.startsWith('M ')).toBe(true)
  })

  it('words right and wrong links differently', () => {
    const t = (id: string) => id
    expect(linkMessage(t, 'a', 'b', { added: true, note: { text: 'N.' } })).toContain('Right link')
    expect(linkMessage(t, 'a', 'b', { added: true, note: null })).toContain('Dashed')
    expect(linkMessage(t, 'a', 'b', { added: false, note: null })).toContain('already')
  })

  it('splits the final question around its slots', () => {
    const segs = questionSegments(c1.final)
    expect(segs.filter((s) => s.kind === 'slot').map((s) => s.slot)).toEqual([0, 1])
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
    const n = c1.notes[0]
    expect(curseView([], c1)).toEqual({ label: `Curse ${c1.curseSteps} / ${c1.curseSteps}`, fraction: 1 })
    expect(curseView([linkKey(n.a, n.b)], c1).label).toBe(`Curse ${c1.curseSteps - 1} / ${c1.curseSteps}`)
  })

  it('gives every clue of every case an icon url', () => {
    for (const c of CASES) for (const k of c.clues) expect(clueIconUrl(k.icon)).toMatch(/^\/assets\/icons\//)
  })
})
