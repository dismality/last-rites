// Minigame 2c, the boots against the print (playtest story pass: a plain comparison, no dragging).
// The print sketched at the robbed grave sits on the left; clicking a pair of boots turns its sole
// up beside it. Kerr's match every nail, the crack and the clay (`compareBootWithPrint`,
// case2Story.ts); a wrong pair costs nothing. PLACEHOLDER art: the soles are flat drawings until
// the detailed boot models are made.
import { useState } from 'react'
import { CASE_2_BOOTS, CASE_2_PRINT, type BootId } from '../../data/cases'
import { CASE2_SAY } from '../../data/case2Narration'
import { compareBootWithPrint } from '../../game/state/case2Story'
import { useCaseStore } from '../../game/state/caseStore'
import type { ResultKind } from '../../game/systems/minigameShell'
import { SoleDrawing } from './case2Drawings'
import { MinigameShell } from './MinigameShell'
import './case2.css'

const CASE_ID = 'resurrection-men'

export function BootPrintsMinigame() {
  const printTaken = useCaseStore((s) => s.cases[CASE_ID].printTaken)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('2c'))
  const [held, setHeld] = useState<BootId | null>(solved ? 'kerr' : null)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)

  const pick = (id: BootId) => {
    setHeld(id)
    const out = compareBootWithPrint(id)
    if (out === 'right') setResult({ kind: 'right', text: 'Kerr’s boots match. A small brass key falls out of one.' })
    else if (out === 'wrong') setResult({ kind: 'wrong', text: CASE2_SAY.bootWrong[id] })
    else setResult({ kind: 'info', text: CASE2_SAY.bootsNoPrint })
  }
  const boot = CASE_2_BOOTS.find((b) => b.id === held)

  return (
    <MinigameShell id="2c" title="The boots by the lodge" result={result}>
      <div className="minigame-shell__body boots">
        <p className="minigame-shell__intro">
          <strong>Click a pair of boots to turn it over beside the print from Arthur Finch’s grave.</strong>
        </p>
        <div className="boots__compare">
          {printTaken ? (
            <SoleDrawing sole={CASE_2_PRINT} label="The print from the grave" />
          ) : (
            <p className="boots__missing">No print yet. Take it from the mud at the foot of Arthur Finch’s grave.</p>
          )}
          {boot ? <SoleDrawing sole={boot} label={boot.title} /> : <p className="boots__missing">Pick a pair below.</p>}
        </div>
        <div className="boots__pairs" role="group" aria-label="The boots by the lodge table">
          {CASE_2_BOOTS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`boots__pair${held === b.id ? ' is-held' : ''}`}
              aria-pressed={held === b.id}
              disabled={solved && b.id !== 'kerr'}
              onClick={() => pick(b.id)}
            >
              {b.title}
            </button>
          ))}
        </div>
      </div>
    </MinigameShell>
  )
}
