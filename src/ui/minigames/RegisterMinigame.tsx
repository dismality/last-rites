// Minigame 2a, the fresh graves against the burial register (playtest story pass). The register on
// the lodge table lists the three fresh graves; beside each line is what the grave showed when the
// player looked at it. The player marks each line: the grave agrees, or it doesn't match. The
// verdict is `markRegisterLine` (case2Story.ts); a wrong mark adds Doubt, as in the Case 1 ledger.
import { useEffect, useState } from 'react'
import { CASE_2_FRESH_GRAVES, type FreshGraveDef } from '../../data/cases'
import { CASE2_SAY } from '../../data/case2Narration'
import { playPageTurn } from '../../audio/AudioManager'
import { markRegisterLine } from '../../game/state/case2Story'
import { useCaseStore } from '../../game/state/caseStore'
import { narrate, useNarrationStore } from '../../game/state/narrationStore'
import type { RegisterMark } from '../../game/systems/caseMinigames'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'
import './case2.css'

const CASE_ID = 'resurrection-men'

export function RegisterMinigame() {
  const seen = useCaseStore((s) => s.cases[CASE_ID].gravesSeen)
  const marked = useCaseStore((s) => s.cases[CASE_ID].registerMarked)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('2a'))
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)

  useEffect(() => {
    if (solved || useNarrationStore.getState().heard.includes(CASE2_SAY.registerOpen[0])) return
    narrate(CASE2_SAY.registerOpen)
  }, [solved])

  const mark = (g: FreshGraveDef, m: RegisterMark) => {
    const out = markRegisterLine(g.id, m)
    if (out === 'right') {
      playPageTurn()
      const all = CASE_2_FRESH_GRAVES.every((x) => useCaseStore.getState().cases[CASE_ID].registerMarked.includes(x.id))
      setResult({
        kind: 'right',
        text: all ? 'Arthur Finch’s grave was robbed. Read the watch log for the night of the 14th.' : `${g.name}: marked.`,
      })
    } else if (out === 'wrong') {
      setResult({ kind: 'wrong', text: m === 'agrees' ? CASE2_SAY.registerNotAgree : CASE2_SAY.registerNotDisturbed })
    }
  }

  return (
    <MinigameShell id="2a" title="The burial register" result={result}>
      <div className="minigame-shell__body register">
        <p className="minigame-shell__intro">
          <strong>Look at each fresh grave by the lodge, then mark whether it agrees with the register.</strong>
        </p>
        <p className="register__count">
          Checked: {marked.length} of {CASE_2_FRESH_GRAVES.length}
        </p>
        <ol className="register__rows">
          {CASE_2_FRESH_GRAVES.map((g) => {
            const looked = seen.includes(g.id)
            const done = marked.includes(g.id)
            return (
              <li key={g.id} className={`register__row${done ? ' is-done' : ''}`} data-grave={g.id}>
                <h3 className="register__name">{g.name}</h3>
                <div className="register__pair">
                  <section className="register__side" aria-label={`Register: ${g.name}`}>
                    <h4 className="register__label">The register says</h4>
                    <p>{g.register}</p>
                  </section>
                  <section className="register__side register__side--grave" aria-label={`Grave: ${g.name}`}>
                    <h4 className="register__label">The grave shows</h4>
                    {looked ? (
                      <p className={g.robbed ? 'register__odd' : ''}>{g.looks}</p>
                    ) : (
                      <p className="register__unread">Not looked at yet. Go to the grave by the lodge.</p>
                    )}
                  </section>
                </div>
                {done ? (
                  <p className="register__verdict">✦ {g.robbed ? 'Doesn’t match: the grave was dug up.' : 'Agrees.'}</p>
                ) : (
                  <div className="register__choices" role="group" aria-label={`Does ${g.name}'s grave agree with the register?`}>
                    <button type="button" className="register__choice" disabled={!looked || solved} onClick={() => mark(g, 'agrees')}>
                      The grave agrees
                    </button>
                    <button
                      type="button"
                      className="register__choice register__choice--odd"
                      disabled={!looked || solved}
                      onClick={() => mark(g, 'disturbed')}
                    >
                      It doesn’t match
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </MinigameShell>
  )
}
