// The name at the altar on the last night (spec 10 task 4.6, Req 18.2; playtest story pass): "Who
// sealed Elias Thorne in the Crane crypt?", typed, then Name. A bare "Vane" is asked again. Once the
// altar holds the name the keeper's write-up writes itself, and the rite's places open below.
// Reads the store and calls `accusationStore.give`; the rules are in caseAnswer.ts and altarAnswer.ts.
import { useState } from 'react'
import { caseOfStage } from '../../data/cases'
import { CLOSED_CASE_PAGES } from '../../data/caseText'
import { useAccusationStore } from '../../game/state/accusationStore'
import { HandwrittenPage } from '../journal/HandwrittenPage'
import { accusationMessage } from './altarPanelView'

export function AccusationSection() {
  const question = caseOfStage(3).accusation
  const given = useAccusationStore((s) => s.record.given)
  const correct = useAccusationStore((s) => s.record.correct)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState('')
  if (!question) return null

  const give = () => setResult(accusationMessage(useAccusationStore.getState().give(typed)))

  return (
    <section className="altar-panel__accusation" aria-labelledby="accusation-title">
      <h3 id="accusation-title" className="altar-panel__subtitle">
        The name
      </h3>
      {correct ? (
        <div className="altar-panel__summary">
          <p className="altar-panel__summary-head">✦ The altar holds the name. The keeper writes it down:</p>
          <HandwrittenPage lines={CLOSED_CASE_PAGES['sealed-catacombs']} className="altar-panel__hand" />
        </div>
      ) : (
        <form
          className="altar-panel__typed"
          onSubmit={(e) => {
            e.preventDefault()
            give()
          }}
        >
          <label className="altar-panel__sentence" htmlFor="accusation-typed">
            {question.template}
          </label>
          <input
            id="accusation-typed"
            className="altar-panel__input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Type the name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button type="submit" className="altar-panel__btn">
            Answer
          </button>
        </form>
      )}
      {/* The state is words and a mark, never colour alone. */}
      <p className="altar-panel__result" role="status" aria-live="assertive">
        {correct ? '' : given && result ? '✕ ' : ''}
        {correct ? 'Now lay the relics for the rite.' : result}
      </p>
    </section>
  )
}
