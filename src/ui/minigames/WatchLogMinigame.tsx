// Minigame 2b, the watch log for the night of the 14th (playtest story pass: reading only, nothing to
// put in order). Each round is one line: the hour, what Kerr wrote, and Dale's countersign. Two
// countersign boxes are empty; clicking one solves it (`checkCountersign`, case2Story.ts). Clicking
// a signed box costs nothing.
import { useEffect, useState } from 'react'
import { CASE_2_WATCH_ROUNDS } from '../../data/cases'
import { CASE2_SAY } from '../../data/case2Narration'
import { checkCountersign } from '../../game/state/case2Story'
import { useCaseStore } from '../../game/state/caseStore'
import { narrate, useNarrationStore } from '../../game/state/narrationStore'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'
import './case2.css'

export function WatchLogMinigame() {
  const solved = useCaseStore((s) => s.cases['resurrection-men'].minigames.includes('2b'))
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)

  useEffect(() => {
    if (solved || useNarrationStore.getState().heard.includes(CASE2_SAY.watchOpen)) return
    narrate(CASE2_SAY.watchOpen)
  }, [solved])

  const box = (i: number) => {
    const out = checkCountersign(i)
    setResult(
      out === 'solved'
        ? { kind: 'right', text: 'Midnight to 2 am: Kerr alone, not countersigned.' }
        : { kind: 'info', text: CASE2_SAY.watchSigned },
    )
  }

  return (
    <MinigameShell id="2b" title="The watch log" result={result}>
      <div className="minigame-shell__body watch">
        <p className="minigame-shell__intro">
          <strong>Read the night of the 14th, and click whatever looks wrong.</strong>
        </p>
        <table className="watch__page">
          <caption className="watch__date">Night of the 14th of October</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">Rounds</th>
              <th scope="col">Watchman</th>
              <th scope="col">Countersigned</th>
            </tr>
          </thead>
          <tbody>
            {CASE_2_WATCH_ROUNDS.map((r, i) => {
              const empty = r.countersign === null
              return (
                <tr key={r.time} className={empty && solved ? 'is-odd' : ''}>
                  <th scope="row">{r.time}</th>
                  <td className="watch__hand">{r.text}</td>
                  <td className="watch__hand">{r.watchman}</td>
                  <td>
                    <button
                      type="button"
                      className={`watch__sign${empty ? ' watch__sign--empty' : ''}`}
                      aria-label={empty ? `${r.time}: countersign box, empty` : `${r.time}: countersigned by ${r.countersign}`}
                      onClick={() => box(i)}
                    >
                      {empty ? (solved ? 'no one' : '') : r.countersign}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </MinigameShell>
  )
}
