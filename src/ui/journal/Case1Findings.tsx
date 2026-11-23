// Case 1 in the journal (playtest story pass): what the keeper has worked out so far, in order,
// and the one question the journal asks, "Which bell was cut?", once all three cords are pulled.
// "J.V." is stamped large as soon as the ledger shows it, and is named once the tag is read.
// Reads the Case_Store; the answer goes through `answerCutBell` (case1Story).
import { useState } from 'react'
import { CASE_1_BELLS, CASE_1_STONES, type BellPostId } from '../../data/cases'
import { answerCutBell } from '../../game/state/case1Story'
import { useCaseStore } from '../../game/state/caseStore'
import { candidateGraves } from '../../game/systems/caseMinigames'

const CASE_ID = 'saved-by-the-bell'
const nameOf = (stoneId: string) => CASE_1_STONES.find((s) => s.id === stoneId)?.name ?? stoneId
const PELL_TAG = CASE_1_BELLS.find((b) => b.condition === 'rope-cut')?.tag ?? ''

export function Case1Findings() {
  const p = useCaseStore((s) => s.cases[CASE_ID])
  const closed = useCaseStore((s) => s.closed.includes(CASE_ID))
  const [reply, setReply] = useState('')
  const graves = candidateGraves()
  const ledgerDone = p.minigames.includes('1a')
  const bellsDone = p.minigames.includes('1b')
  const allPulled = CASE_1_BELLS.every((b) => p.bellsExamined.includes(b.id))

  const pick = (id: BellPostId) => {
    const r = answerCutBell(id)
    setReply(r.kind === 'wrong' ? r.text : '')
  }

  return (
    <div className="case1" aria-label="What the keeper has found">
      <ol className="case1__steps">
        <li className={ledgerDone ? 'is-done' : ''}>
          <h4 className="case1__step">1. The ledger against the stones</h4>
          {ledgerDone ? (
            <p>
              Three entries were changed after the burials: <strong>{graves.map(nameOf).join(', ').replace(/, ([^,]*)$/, ' and $1')}</strong>.
              Each one is initialled in the margin, in the same fresh ink:
            </p>
          ) : (
            <p>
              Elias named three graves: <strong>John Pell</strong>, <strong>Esther Ames</strong> and <strong>Tobias Hale</strong>.
              Read each stone, then check it against the ledger on the hut shelf.{' '}
              <span className="case1__tally">
                Stones read: {graves.filter((g) => p.stonesRead.includes(g)).length} of {graves.length}
              </span>
            </p>
          )}
          {ledgerDone && (
            <p className="case1__stamp" aria-label="Initials J.V.">
              <span className="case1__jv">J.V.</span>
              <span className="case1__stamp-note">{bellsDone ? '= Josiah Vane, the undertaker' : 'Who is J.V.?'}</span>
            </p>
          )}
        </li>

        {ledgerDone && (
          <li className={bellsDone ? 'is-done' : ''}>
            <h4 className="case1__step">2. The safety bells</h4>
            <ul className="case1__bells">
              {CASE_1_BELLS.map((b) => {
                const pulled = p.bellsExamined.includes(b.id)
                const rings = b.condition !== 'rope-cut'
                return (
                  <li key={b.id}>
                    <strong>{nameOf(b.stone)}</strong>:{' '}
                    {!pulled ? 'not pulled yet' : rings ? 'the bell rings' : <strong>silent: the cord is cut</strong>}
                  </li>
                )
              })}
            </ul>
            {!allPulled && <p>Pull the cord on each of the three bell posts.</p>}
            {allPulled && !bellsDone && (
              <div className="case-question" role="group" aria-labelledby="case1-cut-q">
                <p className="case-question__count">Question</p>
                <p id="case1-cut-q" className="case-question__text">
                  Which bell was cut?
                </p>
                <div className="case1__answers">
                  {CASE_1_BELLS.map((b) => (
                    <button key={b.id} type="button" className="case1__answer" onClick={() => pick(b.id)}>
                      {nameOf(b.stone)}’s bell
                    </button>
                  ))}
                </div>
                <p className="case-question__how" role="status" aria-live="polite">
                  {reply || 'Wrong guesses cost nothing.'}
                </p>
              </div>
            )}
            {bellsDone && (
              <>
                <p>
                  <strong>John Pell’s cord was cut</strong>, so no one would hear him ring. Tied to the cut end:
                </p>
                <blockquote className="case1__tag">{PELL_TAG}</blockquote>
              </>
            )}
          </li>
        )}

        {bellsDone && (
          <li className={closed ? 'is-done' : ''}>
            <h4 className="case1__step">3. The altar</h4>
            {closed ? (
              <p>Named at the altar: Josiah Vane. The whole case is written up under Closed cases.</p>
            ) : (
              <p>
                When night falls, go to the chapel altar and answer: <strong>Who silenced John Pell?</strong> Type the name.
              </p>
            )}
          </li>
        )}
      </ol>
    </div>
  )
}
