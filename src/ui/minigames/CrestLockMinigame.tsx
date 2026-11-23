// Minigame 2a, The Crest Lock (spec 10 task 5.4, Req 19). Four crest dials in the sexton's niche on
// Mausoleum Row. The lodge note says to turn them in the order the founders were laid down; the
// years are on the six crypt name tablets (shown here as read, and on the crypts themselves). The
// pure `crestDials` rule judges. A wrong setting adds Doubt and says "The lock does not give"; it
// never says which dial is wrong. The right one solves 2a: the niche opens on the Sexton's Bone
// Whistle (a reward spawn) and the sexton's ledger of night watches (a clue).
// Mouse: the ▲ and ▼ buttons turn a dial. Keyboard alone: Left/Right choose a dial, Up/Down turn it,
// Enter judges. The dials are kept in the Case_Store when the overlay closes. No timer.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CASE_2_CREST_LOCK, CREST_GLYPHS, CREST_NAMES, type CrestId } from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { crestDials } from '../../game/systems/caseMinigames'
import { CREST_DIAL_COUNT } from '../../game/systems/caseSave'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'resurrection-men'
const CRESTS = CASE_2_CREST_LOCK.dialCrests

/** One turn of a dial: an unturned dial starts at the first crest; the crests wrap round. */
function turnDial(value: CrestId | null, step: 1 | -1): CrestId {
  if (value === null) return step === 1 ? CRESTS[0] : CRESTS[CRESTS.length - 1]
  const i = CRESTS.indexOf(value)
  return CRESTS[(i + step + CRESTS.length) % CRESTS.length]
}

export function CrestLockMinigame() {
  const dials = useCaseStore((s) => s.cases[CASE_ID].crestDials)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('2a'))
  const [cursor, setCursor] = useState(0)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => area.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })

  const turn = (i: number, step: 1 | -1) => {
    if (solved) return
    const next = [...dials]
    next[i] = turnDial(next[i], step)
    useCaseStore.getState().setCrestDials(next)
    setCursor(i)
    setResult(null)
    setCaptions((c) => [...c.slice(-3), '[a stone dial clicks]'])
  }

  const confirm = () => {
    if (solved) return say('info', 'The niche is already open.')
    if (dials.some((d) => d === null)) return say('info', 'Turn all four dials first.')
    const verdict = crestDials(dials)
    if (!verdict.ok) {
      useCaseStore.getState().submitMinigame('2a', false)
      setCaptions((c) => [...c, '[the lock grates and holds]'])
      return say('wrong', verdict.message ?? CASE_2_CREST_LOCK.wrongMessage)
    }
    useCaseStore.getState().submitMinigame('2a', true)
    setCaptions((c) => [...c, '[stone grinds open]'])
    say(
      'right',
      "The lock gives. In the niche lie the Sexton's Bone Whistle and his ledger of night watches. Pinned to the case board.",
    )
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.code)) return
    if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return
    e.preventDefault()
    if (e.code === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1))
    else if (e.code === 'ArrowRight') setCursor((c) => Math.min(CREST_DIAL_COUNT - 1, c + 1))
    else if (e.code === 'ArrowUp') turn(cursor, 1)
    else if (e.code === 'ArrowDown') turn(cursor, -1)
    else confirm()
  }

  return (
    <MinigameShell id="2a" title="The Crest Lock" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="crest__intro">
          <strong>Set the four dials to the founders&apos; crests, oldest first.</strong> The years are listed
          below. Turn a dial with ▲ and ▼, then <strong>Try the lock</strong>.
          <span className="minigame-shell__sr"> Keyboard: Left and Right choose a dial, Up and Down turn it, Enter tries the lock.</span>
        </p>
        <blockquote className="crest__note">
          <span className="crest__note-from">A note from the lodge:</span> &ldquo;{CASE_2_CREST_LOCK.note}.&rdquo;
        </blockquote>

        <div
          ref={area}
          className="crest__dials"
          tabIndex={0}
          role="group"
          aria-label={`Crest dials. Dial ${cursor + 1} of ${CREST_DIAL_COUNT}: ${
            dials[cursor] ? CREST_NAMES[dials[cursor]!] : 'not turned'
          }`}
        >
          {dials.map((d, i) => (
            <div key={i} className="crest__dial" data-chosen={i === cursor ? 'true' : undefined}>
              <button type="button" className="crest__turn" tabIndex={-1} disabled={solved} aria-label={`Turn dial ${i + 1} up`} onClick={() => turn(i, 1)}>
                ▲
              </button>
              <span className="crest__face" data-dial={i} data-crest={d ?? ''}>
                <span className="crest__glyph" aria-hidden="true">{d ? CREST_GLYPHS[d] : '·'}</span>
                <span className="crest__name">
                  {i === cursor ? '▸ ' : ''}
                  {d ? CREST_NAMES[d] : 'Unturned'}
                </span>
              </span>
              <button type="button" className="crest__turn" tabIndex={-1} disabled={solved} aria-label={`Turn dial ${i + 1} down`} onClick={() => turn(i, -1)}>
                ▼
              </button>
            </div>
          ))}
        </div>

        <div className="hymn__actions">
          <button type="button" className="hymn__act" tabIndex={-1} disabled={solved} onClick={confirm}>
            Try the lock
          </button>
        </div>

        <section className="crest__tablets" aria-label="Crypt name tablets on Mausoleum Row">
          <h3 className="hymn__heading">The crypt name tablets, as read on the Row</h3>
          <ul>
            {CASE_2_CREST_LOCK.tablets.map((t) => (
              <li key={t.family}>
                <span className="crest__tablet-glyph" aria-hidden="true">{CREST_GLYPHS[t.crest]}</span>{' '}
                <strong>{t.family}</strong> ({CREST_NAMES[t.crest]}): the founder laid down in {t.year}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MinigameShell>
  )
}
