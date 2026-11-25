// Minigame 2d, Kerr's locker (playtest story pass). Vane & Sons tool lockers carry a crest lock: the
// key turns only once the dial shows the right family crest under the arrow. Six crests ring the
// brass plate; a click turns the dial one place. The sketch of the seal from John Pell's tag sits
// beside it. The verdict is `turnLockerKey` (case2Story.ts); a wrong crest costs nothing.
import { useEffect, useState } from 'react'
import { CASE_2_CRESTS, CASE_2_RECEIPT, CASE_2_VANE_CREST } from '../../data/cases'
import { CASE2_SAY } from '../../data/case2Narration'
import { turnLockerKey } from '../../game/state/case2Story'
import { useCaseStore } from '../../game/state/caseStore'
import { narrate, useNarrationStore } from '../../game/state/narrationStore'
import type { ResultKind } from '../../game/systems/minigameShell'
import { CrestBadge } from './case2Drawings'
import { crestName } from './crestName'
import { MinigameShell } from './MinigameShell'
import './case2.css'

const N = CASE_2_CRESTS.length
const VANE = CASE_2_CRESTS.find((c) => c.id === CASE_2_VANE_CREST)!

export function CrestLockMinigame() {
  const open = useCaseStore((s) => s.cases['resurrection-men'].minigames.includes('2d'))
  // The dial starts with the first crest under the arrow (never the Vane crest).
  const [at, setAt] = useState(0)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)

  useEffect(() => {
    if (open || useNarrationStore.getState().heard.includes(CASE2_SAY.lockerFirst[0])) return
    narrate(CASE2_SAY.lockerFirst)
  }, [open])

  const top = CASE_2_CRESTS[open ? CASE_2_CRESTS.indexOf(VANE) : at]
  const turn = (step: number) => {
    setAt((a) => (a + step + N) % N)
    setResult(null)
  }
  const key = () => {
    const out = turnLockerKey(top.id)
    if (out === 'open') setResult({ kind: 'right', text: 'The locker opens: a bone whistle, and a receipt.' })
    else if (out === 'wrong') setResult({ kind: 'wrong', text: CASE2_SAY.crestWrong })
    else setResult({ kind: 'info', text: CASE2_SAY.lockerNoKey })
  }

  return (
    <MinigameShell id="2d" title="Kerr's locker" result={result}>
      <div className="minigame-shell__body crestlock">
        <p className="minigame-shell__intro">
          <strong>Turn the dial until the right family crest is under the arrow, then turn the key.</strong>
        </p>
        <div className="crestlock__layout">
          <div className="crestlock__plate" aria-label={`Crest under the arrow: ${crestName(top)}`}>
            <span className="crestlock__arrow" aria-hidden="true">
              ▼
            </span>
            <button type="button" className="crestlock__dial" disabled={open} onClick={() => turn(1)} aria-label="Turn the dial">
              {CASE_2_CRESTS.map((c, i) => {
                const slot = (i - (open ? CASE_2_CRESTS.indexOf(VANE) : at) + N) % N
                const angle = (slot / N) * 360
                return (
                  <span
                    key={c.id}
                    className={`crestlock__crest${slot === 0 ? ' is-top' : ''}`}
                    style={{ transform: `rotate(${angle}deg) translateY(-108px) rotate(${-angle}deg)` }}
                  >
                    <CrestBadge crest={c.id} name={crestName(c)} />
                  </span>
                )
              })}
              <span className="crestlock__keyhole" aria-hidden="true" />
            </button>
            <p className="crestlock__now">{crestName(top)}</p>
          </div>
          <aside className="crestlock__seal" aria-label="Sketch in the journal: the seal on John Pell's tag">
            <CrestBadge crest={VANE.id} name={crestName(VANE)} />
            <p>The seal on John Pell’s tag. Vane family crest.</p>
          </aside>
        </div>
        {open ? (
          <blockquote className="crestlock__receipt">{CASE_2_RECEIPT}</blockquote>
        ) : (
          <div className="crestlock__actions">
            <button type="button" className="crestlock__btn" onClick={() => turn(-1)}>
              Turn back
            </button>
            <button type="button" className="crestlock__btn" onClick={() => turn(1)}>
              Turn on
            </button>
            <button type="button" className="crestlock__btn crestlock__btn--key" onClick={key}>
              Turn the key
            </button>
          </div>
        )}
      </div>
    </MinigameShell>
  )
}
