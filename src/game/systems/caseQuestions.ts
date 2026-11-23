// Case board questions (playtest: free linking was guesswork). The board asks about one card at a
// time and the player clicks the card that answers it; a right answer draws the string the old way,
// through the same link action. The next question is the first of the case's notes not yet earned
// whose two cards are both on the board. Pure: no React, store or clock access.

import type { CaseDef, DeductionNote } from '../../data/cases'
import { linkKey } from './caseBoard'

export interface CaseQuestion {
  /** The card the question is about. */
  about: string
  /** The card that answers it. */
  answer: string
  text: string
  /** 1-based number among the case's questions, and how many there are. */
  number: number
  total: number
}

export type QuestionState =
  | { kind: 'ask'; question: CaseQuestion }
  /** Questions are left, but their cards are not all found yet. */
  | { kind: 'wait'; left: number }
  | { kind: 'done' }

const questionText = (n: DeductionNote, titleOf: (id: string) => string): string =>
  n.question ?? `Which card explains “${titleOf(n.a)}”?`

export function nextQuestion(
  def: CaseDef,
  found: ReadonlySet<string>,
  links: readonly string[],
  titleOf: (id: string) => string,
): QuestionState {
  const earned = new Set(links)
  const open = def.notes.filter((n) => !earned.has(linkKey(n.a, n.b)))
  if (open.length === 0) return { kind: 'done' }
  const n = open.find((x) => found.has(x.a) && found.has(x.b))
  if (!n) return { kind: 'wait', left: open.length }
  return {
    kind: 'ask',
    question: {
      about: n.a,
      answer: n.b,
      text: questionText(n, titleOf),
      number: def.notes.length - open.length + 1,
      total: def.notes.length,
    },
  }
}
