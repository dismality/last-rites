// Case 3 in the journal (playtest story pass): what the keeper has worked out about Elias's last
// night, step by step: the hymn board, the cart ruts, the pinned Crane crypt door, Elias's letter
// and the note, then the handwriting laid side by side (3d, click only), then the name for the
// altar. Reads the Case_Store; a click on a sample calls `compareHandSample` in case3Story.ts.
import { Fragment, useEffect } from 'react'
import { CASE3_SAY } from '../../data/case3Narration'
import { CASE_3_HAND_SAMPLES, CASE_3_LETTER, CASE_3_NOTE, CASE_3_OIL_CRYPT, type HandSampleDef } from '../../data/cases'
import { compareHandSample } from '../../game/state/case3Story'
import { useCaseStore } from '../../game/state/caseStore'
import { narrate } from '../../game/state/narrationStore'

const CASE_ID = 'sealed-catacombs'

/** The keeper says what the handwriting page is once per session, the first time it opens. */
let handOpenSaid = false

/**
 * A sample's words, with its tell-tale letters drawn: {V} the looped V, {s} the long s, {v} a plain
 * V. Once the sample is compared, those letters are circled.
 */
function HandText({ sample, circled }: { sample: HandSampleDef; circled: boolean }) {
  const parts = sample.text.split(/(\{[Vsv]\})/)
  return (
    <span className={`hand__text${sample.careful ? ' hand__text--careful' : ' hand__text--plain'}`}>
      {parts.map((part, i) => {
        if (part === '{V}')
          return (
            <span key={i} className={`hand__glyph hand__glyph--loop${circled ? ' is-circled' : ''}`} aria-label="V, looped">
              𝒱
            </span>
          )
        if (part === '{s}')
          return (
            <span key={i} className={`hand__glyph hand__glyph--long${circled ? ' is-circled' : ''}`} aria-label="s, long">
              ſ
            </span>
          )
        if (part === '{v}')
          return (
            <span key={i} className={`hand__glyph hand__glyph--plain${circled ? ' is-circled' : ''}`} aria-label="V, plain">
              V
            </span>
          )
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}

/** The four hands side by side. Each is a button: comparing it circles its letters and says what they show. */
function HandComparison() {
  const seen = useCaseStore((s) => s.cases[CASE_ID].handSeen)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('3d'))
  useEffect(() => {
    if (handOpenSaid || solved || seen.length > 0) return
    handOpenSaid = true
    narrate(CASE3_SAY.handOpen)
  }, [seen.length, solved])

  return (
    <div className="hand" role="group" aria-label="Handwriting compared">
      <p>Click each sample to look closely at its letters.</p>
      <ul className="hand__samples">
        {CASE_3_HAND_SAMPLES.map((sample) => {
          const looked = solved || seen.includes(sample.id)
          return (
            <li key={sample.id}>
              <button
                type="button"
                className="hand__sample"
                data-sample={sample.id}
                aria-pressed={looked}
                onClick={() => compareHandSample(sample.id)}
              >
                <span className="hand__title">{sample.title}</span>
                <HandText sample={sample} circled={looked} />
                <span className="hand__feature">{looked ? `✓ ${sample.feature}` : 'Not looked at yet'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="case1__tally">
        Compared: {solved ? CASE_3_HAND_SAMPLES.length : seen.length} of {CASE_3_HAND_SAMPLES.length}
      </p>
    </div>
  )
}

export function Case3Findings() {
  const p = useCaseStore((s) => s.cases[CASE_ID])
  const closed = useCaseStore((s) => s.closed.includes(CASE_ID))
  const did = (id: '3a' | '3b' | '3c' | '3d') => p.minigames.includes(id)
  const ruts = did('3b') || p.found.includes('hearse-cart-ruts')
  const oil = p.found.includes('oil-other-crypt')

  return (
    <div className="case1" aria-label="What the keeper has found">
      <ol className="case1__steps">
        <li className={did('3a') ? 'is-done' : ''}>
          <h4 className="case1__step">1. The hymn board</h4>
          {did('3a') ? (
            <p>
              The first letters of the hymns spell <strong>BELOW</strong>. The stair behind the altar is open.
            </p>
          ) : (
            <p>Elias’s last page: “I’m going below the chapel tonight.” The hymn board in the chapel has been changed.</p>
          )}
        </li>

        {did('3a') && (
          <li className={ruts ? 'is-done' : ''}>
            <h4 className="case1__step">2. The cart ruts</h4>
            {ruts ? (
              <p>
                A hearse cart came in at the Row gate and down the avenue. Its ruts stop at the <strong>Crane crypt</strong>.
                {oil && ` The spilled oil at the ${CASE_3_OIL_CRYPT} crypt was a false lead: no ruts went there.`}
              </p>
            ) : (
              <p>His page named the Crane crypt, at the far end of Mausoleum Row. Look for cart ruts at the Row gate.</p>
            )}
          </li>
        )}

        {ruts && (
          <li className={did('3b') ? 'is-done' : ''}>
            <h4 className="case1__step">3. The Crane crypt door</h4>
            {did('3b') ? (
              <p>
                Pinned shut from outside with a hearse pin stamped with the <strong>Vane raven</strong>. Fingernail marks
                cover the inside of the door. Elias was alive when it was shut.
              </p>
            ) : (
              <p>The ruts end at the Crane crypt. Something holds its door shut.</p>
            )}
          </li>
        )}

        {did('3b') && (
          <li className={did('3c') ? 'is-done' : ''}>
            <h4 className="case1__step">4. Elias</h4>
            {did('3c') ? (
              <>
                <p>His letter, never sent:</p>
                <blockquote className="case1__tag">{CASE_3_LETTER}</blockquote>
                <p>And the note that called him here:</p>
                <blockquote className="case1__tag">{CASE_3_NOTE}</blockquote>
              </>
            ) : (
              <p>Elias is slumped inside the door. Search him.</p>
            )}
          </li>
        )}

        {did('3c') && (
          <li className={did('3d') ? 'is-done' : ''}>
            <h4 className="case1__step">5. The handwriting</h4>
            <HandComparison />
            {did('3d') && (
              <p>
                The ledger, the receipt and the note share one hand: the looped V and the long s. Josiah’s signature is
                plain. <strong>The son, Silas Vane, wrote them.</strong>
              </p>
            )}
          </li>
        )}

        {did('3d') && (
          <li className={closed ? 'is-done' : ''}>
            <h4 className="case1__step">6. The altar</h4>
            {closed ? (
              <p>Named at the altar: Silas Vane. Elias Thorne is found.</p>
            ) : (
              <p>
                When night falls, go to the chapel altar and answer:{' '}
                <strong>Who sealed Elias Thorne in the Crane crypt?</strong> Type the name, then lay the relics for the rite.
              </p>
            )}
          </li>
        )}
      </ol>
    </div>
  )
}
