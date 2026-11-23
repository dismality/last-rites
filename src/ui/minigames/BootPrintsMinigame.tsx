// Minigame 2c, Boot Prints (spec 10 task 5.5, Req 21). Three plaster casts from the Ames grave and
// the four suspects' boots, each shown with tread, size and hobnails. The player picks a cast and a
// pair of boots and pairs them. The pure `bootMatch` rule judges. A wrong pair adds Doubt and says
// which feature disagrees; the right pair solves 2c and pins the matching-boots card.
// Mouse: click a cast, click a pair of boots, then Pair. Keyboard alone: Up/Down choose a cast,
// Left/Right choose boots, Enter pairs them. No timer and nothing to keep: a pairing is one act.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CASE_2_BOOTS, CASE_2_CASTS, type PrintDetails } from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { bootMatch } from '../../game/systems/caseMinigames'
import type { ResultKind } from '../../game/systems/minigameShell'
import { useOverlayStore } from '../../game/state/overlayStore'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'resurrection-men'

function Details({ d }: { d: PrintDetails }) {
  return (
    <dl className="boots__details">
      <dt>Tread</dt>
      <dd>{d.tread}</dd>
      <dt>Size</dt>
      <dd>{d.size ?? 'too worn to tell'}</dd>
      <dt>Hobnails</dt>
      <dd>{d.hobnails}</dd>
    </dl>
  )
}

export function BootPrintsMinigame() {
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('2c'))
  const focus = useOverlayStore((s) => s.castFocus)
  const [cast, setCast] = useState(() => Math.max(0, CASE_2_CASTS.findIndex((c) => c.id === focus)))
  const [boot, setBoot] = useState(0)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => area.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })

  const pair = () => {
    if (solved) return say('info', 'The boots are already matched.')
    const c = CASE_2_CASTS[cast]
    const b = CASE_2_BOOTS[boot]
    const verdict = bootMatch(c.id, b.owner)
    if (!verdict.ok) {
      useCaseStore.getState().submitMinigame('2c', false)
      setCaptions((x) => [...x, '[plaster scrapes on leather]'])
      return say('wrong', `${c.title} and ${b.title.toLowerCase()}: ${verdict.message ?? 'they do not agree.'}`)
    }
    useCaseStore.getState().submitMinigame('2c', true)
    setCaptions((x) => [...x, '[the cast settles into the sole]'])
    say('right', `${c.title} fits ${b.title.toLowerCase()} exactly: tread, size and the missing hobnail. Pinned to the case board.`)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.code)) return
    if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return
    e.preventDefault()
    setResult(null)
    if (e.code === 'ArrowUp') setCast((i) => Math.max(0, i - 1))
    else if (e.code === 'ArrowDown') setCast((i) => Math.min(CASE_2_CASTS.length - 1, i + 1))
    else if (e.code === 'ArrowLeft') setBoot((i) => Math.max(0, i - 1))
    else if (e.code === 'ArrowRight') setBoot((i) => Math.min(CASE_2_BOOTS.length - 1, i + 1))
    else pair()
  }

  return (
    <MinigameShell id="2c" title="Boot Prints" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="boots__intro">
          <strong>Match each plaster cast from the Ames grave to a suspect&apos;s boots.</strong> Compare the{' '}
          <strong>tread, size and hobnails</strong>. Click a cast and a pair of boots, then <strong>Pair them</strong>.
          <span className="minigame-shell__sr"> Keyboard: Up and Down choose a cast, Left and Right choose boots, Enter pairs.</span>
        </p>
        <div
          ref={area}
          className="boots__spread"
          tabIndex={0}
          role="group"
          aria-label={`Cast: ${CASE_2_CASTS[cast].title}. Boots: ${CASE_2_BOOTS[boot].title}.`}
        >
          <section className="boots__column" aria-label="Plaster casts">
            <h3 className="hymn__heading">Casts from the grave</h3>
            {CASE_2_CASTS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className="boots__card"
                tabIndex={-1}
                aria-pressed={i === cast}
                data-cast={c.id}
                onClick={() => {
                  setCast(i)
                  setResult(null)
                  area.current?.focus()
                }}
              >
                <span className="boots__title">
                  {i === cast ? '▸ ' : ''}
                  {c.title}
                </span>
                <span className="boots__label">{c.label}</span>
                <Details d={c} />
              </button>
            ))}
          </section>
          <section className="boots__column boots__column--boots" aria-label="Suspects' boots">
            <h3 className="hymn__heading">The suspects&apos; boots</h3>
            <div className="boots__row">
              {CASE_2_BOOTS.map((b, i) => (
                <button
                  key={b.owner}
                  type="button"
                  className="boots__card"
                  tabIndex={-1}
                  aria-pressed={i === boot}
                  data-boot={b.owner}
                  onClick={() => {
                    setBoot(i)
                    setResult(null)
                    area.current?.focus()
                  }}
                >
                  <span className="boots__title">
                    {i === boot ? '▸ ' : ''}
                    {b.title}
                  </span>
                  <Details d={b} />
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="hymn__actions">
          <button type="button" className="hymn__act" tabIndex={-1} disabled={solved} onClick={pair}>
            Pair them
          </button>
        </div>
      </div>
    </MinigameShell>
  )
}
