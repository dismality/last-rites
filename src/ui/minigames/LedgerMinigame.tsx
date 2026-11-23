// Minigame 1a, the Ledger against the Stones (spec 10 task 3.4, Req 12; playtest story pass).
// The ledger page shows the three graves Elias named: John Pell, Esther Ames and Tobias Hale. For
// each, the ledger line sits beside what the stone says, once the player has read that stone at
// the grave. The player marks each line: the stone agrees, or it disagrees on the date, the plot
// or the cause of death. The verdict is the pure `applyFlag` / `ledgerFlags` rule; a wrong mark
// adds Doubt through the Case_Store. Marks live in the Case_Store, so closing keeps them. No timer.
import { useEffect, useState } from 'react'
import { CASE_1_LEDGER, CASE_1_STONES, type LedgerFlagKind, type StoneRubbingDef } from '../../data/cases'
import { CASE1_SAY } from '../../data/case1Narration'
import { playPageTurn } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { narrate, useNarrationStore } from '../../game/state/narrationStore'
import { candidateGraves } from '../../game/systems/caseMinigames'
import { applyFlag, FLAG_KINDS, FLAG_LABEL, joinLine } from '../../game/systems/ledgerMinigame'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'saved-by-the-bell'
const PAGE_TURN_CAPTION = '[a page turns]'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "1862-03-11" as "11 March 1862". */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1] ?? ''} ${y}`
}

/** "Grounds, west row 1" as "West row, plot 1". */
const plotText = (plot: string) => {
  const m = /(\w+) row (\d+)/.exec(plot)
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} row, plot ${m[2]}` : plot
}

const DIFFERS: Record<LedgerFlagKind, string> = { date: 'The date differs', plot: 'The plot differs', cause: 'The cause differs' }

/** The three graves, in the order Elias wrote them. */
const GRAVES: readonly StoneRubbingDef[] = ['pell', 'ames', 'hale']
  .filter((id) => candidateGraves().includes(id))
  .map((id) => CASE_1_STONES.find((s) => s.id === id)!)

export function LedgerMinigame() {
  const lines = useCaseStore((s) => s.cases[CASE_ID].ledgerLines)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('1a'))
  const read = useCaseStore((s) => s.cases[CASE_ID].stonesRead)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])

  // The first time the ledger is opened this run, the keeper says what to do with it.
  useEffect(() => {
    if (solved || useNarrationStore.getState().heard.includes(CASE1_SAY.ledgerOpen[0])) return
    narrate(CASE1_SAY.ledgerOpen)
  }, [solved])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })

  const mark = (stone: StoneRubbingDef, kind: LedgerFlagKind | 'agrees') => {
    if (solved) return
    if (kind === 'agrees') {
      useCaseStore.getState().submitMinigame('1a', false)
      narrate(CASE1_SAY.ledgerNotAgree)
      return say('wrong', CASE1_SAY.ledgerNotAgree)
    }
    const joined = joinLine(lines, stone.id, stone.ledgerId)
    const out = applyFlag(joined, stone.id, kind)
    if (out.kind === 'right') {
      useCaseStore.getState().setLedgerLines(out.lines)
      playPageTurn()
      setCaptions((c) => [...c, PAGE_TURN_CAPTION])
      if (out.solved) {
        useCaseStore.getState().submitMinigame('1a', true)
        narrate([...(CASE1_SAY.ledgerRight[stone.id] ?? []), ...CASE1_SAY.ledgerSolved])
        say('right', 'Three entries were changed: John Pell, Esther Ames and Tobias Hale. Check their bells next.')
      } else {
        narrate(CASE1_SAY.ledgerRight[stone.id] ?? [])
        say('right', `${stone.name}: ${FLAG_LABEL[kind].toLowerCase()} does not match.`)
      }
    } else if (out.kind === 'wrong') {
      useCaseStore.getState().submitMinigame('1a', false)
      const text = CASE1_SAY.ledgerWrongKind(kind)
      narrate(text)
      say('wrong', text)
    } else {
      say('info', out.message)
    }
  }

  const done = GRAVES.filter((g) => lines.some((l) => l.stoneId === g.id && l.flag)).length

  return (
    <MinigameShell id="1a" title="The parish ledger" captions={captions} result={result}>
      <div className="minigame-shell__body ledger2">
        <p className="minigame-shell__intro">
          <strong>Read each grave’s stone, then mark whether the ledger agrees with it.</strong>
        </p>
        <p className="ledger2__count">
          Checked: {done} of {GRAVES.length}
        </p>
        <ol className="ledger2__rows">
          {GRAVES.map((stone) => {
            const entry = CASE_1_LEDGER.find((e) => e.id === stone.ledgerId)!
            const line = lines.find((l) => l.stoneId === stone.id)
            const seen = solved || read.includes(stone.id) || !!line?.flag
            const differs = line?.flag ?? null
            const odd = (k: LedgerFlagKind) => (differs === k ? ' is-odd' : '')
            return (
              <li key={stone.id} className={`ledger2__row${differs ? ' is-done' : ''}`} data-grave={stone.id}>
                <h3 className="ledger2__name">{entry.name}</h3>
                <div className="ledger2__pair">
                  <section className="ledger2__side ledger2__side--ledger" aria-label={`Ledger: ${entry.name}`}>
                    <h4 className="ledger2__label">The ledger says</h4>
                    <dl className="ledger2__facts">
                      <dt>Died</dt>
                      <dd className={odd('date')}>{longDate(entry.date)}</dd>
                      <dt>Plot</dt>
                      <dd className={odd('plot')}>{plotText(entry.plot)}</dd>
                      <dt>Cause</dt>
                      <dd className={odd('cause')}>{entry.cause}</dd>
                    </dl>
                    {entry.amendedBy && (
                      <p className="ledger2__initials" title="Initials in the margin, in fresh ink">
                        {entry.amendedBy}
                      </p>
                    )}
                  </section>
                  <section className="ledger2__side ledger2__side--stone" aria-label={`Stone: ${stone.name}`}>
                    <h4 className="ledger2__label">The stone says</h4>
                    {seen ? (
                      <dl className="ledger2__facts">
                        <dt>Died</dt>
                        <dd className={odd('date')}>{longDate(stone.date)}</dd>
                        <dt>Plot</dt>
                        <dd className={odd('plot')}>{plotText(stone.plot)}</dd>
                        <dt>Cause</dt>
                        <dd className={odd('cause')}>{stone.cause ?? '(not carved)'}</dd>
                      </dl>
                    ) : (
                      <p className="ledger2__unread">
                        <strong>Not read yet.</strong> Go to the grave of {stone.name} ({plotText(stone.plot).toLowerCase()})
                        and read the stone.
                      </p>
                    )}
                  </section>
                </div>
                {differs ? (
                  <p className="ledger2__verdict">✦ Disagrees: {FLAG_LABEL[differs].toLowerCase()}.</p>
                ) : (
                  <div className="ledger2__choices" role="group" aria-label={`Does the ledger agree with the stone of ${stone.name}?`}>
                    <button type="button" className="ledger2__choice" disabled={!seen || solved} onClick={() => mark(stone, 'agrees')}>
                      The stone agrees
                    </button>
                    {FLAG_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="ledger2__choice ledger2__choice--differs"
                        disabled={!seen || solved}
                        onClick={() => mark(stone, k)}
                      >
                        {DIFFERS[k]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        {solved && (
          <p className="ledger2__solved">
            ✦ Three entries were changed after the burials, each initialled <strong className="ledger2__jv">J.V.</strong>:{' '}
            <strong>John Pell</strong>, <strong>Esther Ames</strong> and <strong>Tobias Hale</strong>. Each of their graves
            has a safety bell: check the bells next.
          </p>
        )}
      </div>
    </MinigameShell>
  )
}
