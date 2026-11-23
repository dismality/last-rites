import { describe, expect, it } from 'vitest'
import { caseOfStage } from '../../data/cases'
import { linkKey } from './caseBoard'
import { nextQuestion } from './caseQuestions'

const STAGES = [1, 2, 3] as const

describe('case board questions', () => {
  it.each(STAGES)('stage %i: every link has a question that does not name its answer', (stage) => {
    const def = caseOfStage(stage)
    for (const n of def.notes) {
      expect(n.question, `${n.a} + ${n.b}`).toBeTruthy()
      const answer = def.clues.find((c) => c.id === n.b)!.title
      expect(n.question!.toLowerCase()).not.toContain(answer.toLowerCase())
    }
  })

  it.each(STAGES)('stage %i: asks each link once, in order, then is done', (stage) => {
    const def = caseOfStage(stage)
    const found = new Set(def.clues.map((c) => c.id))
    const links: string[] = []
    const title = (id: string) => id
    for (let i = 0; i < def.notes.length; i++) {
      const s = nextQuestion(def, found, links, title)
      expect(s.kind).toBe('ask')
      if (s.kind !== 'ask') return
      expect(s.question.number).toBe(i + 1)
      expect(s.question.total).toBe(def.notes.length)
      links.push(linkKey(s.question.about, s.question.answer))
    }
    expect(nextQuestion(def, found, links, title).kind).toBe('done')
  })

  it('skips a question whose cards are not found yet, and waits when none is ready', () => {
    const def = caseOfStage(2)
    const first = def.notes[0]
    const found = new Set([first.a])
    expect(nextQuestion(def, found, [], (id) => id)).toEqual({ kind: 'wait', left: def.notes.length })
    found.add(first.b)
    const s = nextQuestion(def, found, [], (id) => id)
    expect(s.kind === 'ask' && s.question.about).toBe(first.a)
  })

  it('ignores wrong strings: they are not earned links', () => {
    const def = caseOfStage(2)
    const found = new Set(def.clues.map((c) => c.id))
    const s = nextQuestion(def, found, [linkKey(def.clues[0].id, 'nonsense')], (id) => id)
    expect(s.kind === 'ask' && s.question.number).toBe(1)
  })
})
