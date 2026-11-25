// Case 2 in the journal (playtest story pass): what the keeper has worked out about the
// resurrection men, step by step: the robbed grave, the gap in the watch log, the print and the
// boots, Kerr's locker, then the question for the altar. Reads the Case_Store only; the screens
// themselves open from the lodge table.
import {
  CASE_2_FRESH_GRAVES,
  CASE_2_PEOPLE,
  CASE_2_PRINT,
  CASE_2_RECEIPT,
  CASE_2_VANE_CREST,
  CASE_2_WATCH_ROUNDS,
} from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { CrestBadge, SoleDrawing } from '../minigames/case2Drawings'
import '../minigames/case2.css'

const CASE_ID = 'resurrection-men'
const ROBBED = CASE_2_FRESH_GRAVES.find((g) => g.robbed)!
const GAPS = CASE_2_WATCH_ROUNDS.filter((r) => r.countersign === null).map((r) => r.time)

export function Case2Findings() {
  const p = useCaseStore((s) => s.cases[CASE_ID])
  const closed = useCaseStore((s) => s.closed.includes(CASE_ID))
  const did = (id: '2a' | '2b' | '2c' | '2d') => p.minigames.includes(id)
  const seen = CASE_2_FRESH_GRAVES.filter((g) => p.gravesSeen.includes(g.id)).length

  return (
    <div className="case1" aria-label="What the keeper has found">
      <ol className="case1__steps">
        <li className={did('2a') ? 'is-done' : ''}>
          <h4 className="case1__step">1. The fresh graves</h4>
          {did('2a') ? (
            <p>
              <strong>{ROBBED.name}’s grave</strong>, buried the {ROBBED.buried}th, was dug up and the coffin emptied. The
              register says it was filled and settled.
            </p>
          ) : (
            <p>
              Three fresh graves by the lodge. Look at each one, then check it against the burial register on the lodge table.{' '}
              <span className="case1__tally">
                Graves seen: {seen} of {CASE_2_FRESH_GRAVES.length}
              </span>
            </p>
          )}
        </li>

        {did('2a') && (
          <li className={did('2b') ? 'is-done' : ''}>
            <h4 className="case1__step">2. The watch log, the night of the {ROBBED.buried}th</h4>
            {did('2b') ? (
              <p>
                {CASE_2_PEOPLE.keeper} logged every round, but the porter, {CASE_2_PEOPLE.porter}, never signed the{' '}
                <strong>{GAPS.join(' and ')}</strong> rounds. {CASE_2_PEOPLE.keeper} was out alone.
              </p>
            ) : (
              <p>
                {CASE_2_PEOPLE.keeper}, the lodge keeper, logs each round and {CASE_2_PEOPLE.porter} countersigns it. Read the
                log on the lodge table.
              </p>
            )}
          </li>
        )}

        {did('2b') && (
          <li className={did('2c') ? 'is-done' : ''}>
            <h4 className="case1__step">3. The boot print</h4>
            {p.printTaken || did('2c') ? (
              <div className="case2__print">
                <SoleDrawing sole={CASE_2_PRINT} label="The print from the robbed grave" />
                <p>
                  {did('2c') ? (
                    <>
                      <strong>{CASE_2_PEOPLE.keeper}’s boots match the print.</strong> A small key fell out of one.
                    </>
                  ) : (
                    'Compare it with the boots by the lodge table.'
                  )}
                </p>
              </div>
            ) : (
              <p>Someone left a print in the mud at the foot of {ROBBED.name}’s grave. Take it.</p>
            )}
          </li>
        )}

        {did('2c') && (
          <li className={did('2d') ? 'is-done' : ''}>
            <h4 className="case1__step">4. {CASE_2_PEOPLE.keeper}’s locker</h4>
            {did('2d') ? (
              <>
                <p>Inside, the bone whistle, and a receipt:</p>
                <blockquote className="case1__tag">{CASE_2_RECEIPT}</blockquote>
                <p>
                  <strong>Vane &amp; Sons paid {CASE_2_PEOPLE.keeper} for bodies.</strong> Same handwriting as the ledger?
                </p>
              </>
            ) : (
              <div className="case2__print">
                <span className="case2__crest">
                  <CrestBadge crest={CASE_2_VANE_CREST} name="Vane family crest" />
                </span>
                <p>The key fits a Vane &amp; Sons crest lock. It turns only with the right family crest.</p>
              </div>
            )}
          </li>
        )}

        {did('2d') && (
          <li className={closed ? 'is-done' : ''}>
            <h4 className="case1__step">5. The altar</h4>
            {closed ? (
              <p>Named at the altar: Vane &amp; Sons. The whole case is written up under Closed cases.</p>
            ) : (
              <p>
                When night falls, go to the chapel altar and answer: <strong>Who paid for the stolen bodies?</strong> Type the
                name.
              </p>
            )}
          </li>
        )}
      </ol>
    </div>
  )
}
