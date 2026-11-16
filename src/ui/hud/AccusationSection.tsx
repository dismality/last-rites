// The Stage 3 accusation at the altar (spec 10 task 4.6, Req 18.2): "Elias was sealed in by ___.
// Motive: ___. Means: ___. Opportunity: ___." One select per blank and an Accuse button, all by
// keyboard. Optional: it never changes whether the run is won. Reads the store and calls
// `accusationStore.give`; the rules are in systems/accusation.ts and altarAnswer.ts.
import { useState } from 'react'
import { caseOfStage } from '../../data/cases'
import { useAccusationStore } from '../../game/state/accusationStore'
import { questionSegments } from '../journal/caseBoardView'
import { accusationMessage } from './altarPanelView'

export function AccusationSection() {
  const question = caseOfStage(3).accusation
  const slots = useAccusationStore((s) => s.slots)
  const given = useAccusationStore((s) => s.record.given)
  const correct = useAccusationStore((s) => s.record.correct)
  const [result, setResult] = useState('')
  if (!question) return null

  return (
    <section className="altar-panel__accusation" aria-labelledby="accusation-title">
      <h3 id="accusation-title" className="altar-panel__subtitle">
        The Accusation (optional)
      </h3>
      <p className="altar-panel__sentence">
        {questionSegments(question).map((seg, i) => {
          if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
          const slot = seg.slot ?? 0
          const def = question.slots[slot]
          return (
            <select
              key={i}
              className="altar-panel__slot"
              aria-label={`Accusation, ${def.label}, blank ${slot + 1} of ${question.slots.length}`}
              value={slots[slot] ?? ''}
              disabled={correct}
              onChange={(e) => useAccusationStore.getState().fillSlot(slot, e.target.value || null)}
            >
              <option value="">(empty)</option>
              {def.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )
        })}
      </p>
      {/* The state is words and a mark, never colour alone. */}
      <p className="altar-panel__result" role="status" aria-live="assertive">
        {correct ? '✦ ' : given ? '✕ ' : ''}
        {result}
      </p>
      <button
        type="button"
        className="altar-panel__btn"
        disabled={correct}
        onClick={() => setResult(accusationMessage(useAccusationStore.getState().give()))}
      >
        Accuse
      </button>
    </section>
  )
}
