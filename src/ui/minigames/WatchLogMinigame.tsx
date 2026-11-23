// Minigame 2b, The Watch Log (spec 10 task 5.3, Req 20). Eight torn pages of the watch-house log lie
// on the lodge table. The player puts them in time order. The pure `watchOrder` rule judges it. A
// wrong order adds Doubt through the Case_Store and marks the first page out of place with a glyph
// and words; the right one solves 2b and shows the two-hour gap and whose watch it was.
// Mouse: drag a page to a place. Keyboard alone: Left/Right choose a page, Space lifts it,
// Left/Right move it, Space puts it down, Enter judges. There is no timer. The arrangement is kept
// in the Case_Store when the overlay closes.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  CASE_2_SUSPECTS,
  CASE_2_WATCH_GAP,
  CASE_2_WATCH_LOG,
  CASE_2_WATCH_ORDER,
  CASE_2_WATCH_SHELF,
  type WatchEntryDef,
  type WatchEntryId,
} from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { watchOrder } from '../../game/systems/caseMinigames'
import type { ResultKind } from '../../game/systems/minigameShell'
import { moveCard, timelineKey } from '../../game/systems/timelineMinigame'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'resurrection-men'

const PAGE_MAP: Readonly<Record<WatchEntryId, WatchEntryDef>> = Object.fromEntries(
  CASE_2_WATCH_LOG.map((e) => [e.id, e]),
) as Record<WatchEntryId, WatchEntryDef>

/** The saved arrangement when it holds all eight pages, else the pages as they lie on the table. */
function startOrder(saved: readonly WatchEntryId[]): WatchEntryId[] {
  return saved.length === CASE_2_WATCH_ORDER.length ? [...saved] : [...CASE_2_WATCH_SHELF]
}

export function WatchLogMinigame() {
  const saved = useCaseStore((s) => s.cases[CASE_ID].watchLog)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('2b'))

  const [order, setOrder] = useState<WatchEntryId[]>(() => (solved ? [...CASE_2_WATCH_ORDER] : startOrder(saved)))
  const [cursor, setCursor] = useState(0)
  const [lifted, setLifted] = useState(false)
  const [outOfPlace, setOutOfPlace] = useState<WatchEntryId | null>(null)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const dragFrom = useRef<number | null>(null)
  const area = useRef<HTMLDivElement>(null)

  // The shell focuses its close button first, so take focus on the next tick.
  useEffect(() => {
    const t = window.setTimeout(() => area.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    useCaseStore.getState().setWatchLog(order)
  }, [order])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })
  const arrange = (next: WatchEntryId[]) => {
    if (solved) return
    setOrder(next)
    setOutOfPlace(null)
    setResult(null)
  }

  const confirm = () => {
    if (solved) return say('info', 'The log is already in order.')
    const verdict = watchOrder(order)
    if (!verdict.ok) {
      useCaseStore.getState().submitMinigame('2b', false)
      const bad = verdict.firstWrong !== undefined ? order[verdict.firstWrong] ?? null : null
      setOutOfPlace(bad)
      if (verdict.firstWrong !== undefined) setCursor(verdict.firstWrong)
      setCaptions((c) => [...c, '[paper rustles]'])
      return say('wrong', `The pages do not run in order. Page ${(verdict.firstWrong ?? 0) + 1} is out of place.`)
    }
    useCaseStore.getState().submitMinigame('2b', true)
    setCaptions((c) => [...c, '[a page turns]'])
    say('right', `${CASE_2_WATCH_GAP.text} Pinned to the case board.`)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) return
    if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return
    e.preventDefault()
    const r = timelineKey<WatchEntryId>({ cursor, lifted, order }, e.code)
    setCursor(r.cursor)
    setLifted(solved ? false : r.lifted)
    if (!solved && r.order.some((id, i) => id !== order[i])) arrange(r.order)
    if (r.confirm) confirm()
  }

  const onDrop = (to: number) => (e: DragEvent) => {
    e.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null) return
    arrange(moveCard(order, from, to))
    setCursor(to)
  }

  const gapAt = solved ? order.indexOf(CASE_2_WATCH_GAP.after) : -1

  return (
    <MinigameShell id="2b" title="The Watch Log" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="timeline__intro">
          <strong>Drag the torn watch-log pages into order through the night.</strong> Each page names its
          hour. <strong>Look for the hours nobody wrote down.</strong>
          <span className="minigame-shell__sr"> Keyboard: Left and Right choose a page, Space lifts and sets it down, Enter judges.</span>
        </p>

        <div className="timeline__ends" aria-hidden="true">
          <span>☾ Evening</span>
          <span>Morning ☼</span>
        </div>

        <div
          ref={area}
          className="timeline__track watchlog__track"
          tabIndex={0}
          role="group"
          aria-label={`Watch log pages, evening to morning. Page ${cursor + 1} of ${order.length}: ${
            PAGE_MAP[order[cursor]].text
          }${lifted ? ', lifted' : ''}`}
        >
          {order.map((id, i) => {
            const page = PAGE_MAP[id]
            const bad = outOfPlace === id
            return (
              <div key={id} className="timeline__slot" onDragOver={(e) => e.preventDefault()} onDrop={onDrop(i)}>
                <span className="timeline__no">{i + 1}</span>
                <button
                  type="button"
                  className="timeline__card"
                  draggable={!solved}
                  tabIndex={-1}
                  aria-pressed={i === cursor}
                  data-lifted={i === cursor && lifted ? 'true' : undefined}
                  data-wrong={bad ? 'true' : undefined}
                  data-page={id}
                  aria-label={`${page.text}${bad ? ', out of place' : ''}`}
                  onDragStart={(e) => {
                    dragFrom.current = i
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', id)
                    setCursor(i)
                  }}
                  onClick={() => {
                    setCursor(i)
                    area.current?.focus()
                  }}
                >
                  <span className="timeline__text">
                    {i === cursor ? (lifted ? '⇅ ' : '▸ ') : ''}
                    {page.text}
                  </span>
                  {bad && <span className="timeline__flag">✕ Out of place</span>}
                  {i === gapAt && <span className="timeline__flag watchlog__gap">⌛ Two hours, nothing written</span>}
                </button>
              </div>
            )
          })}
        </div>

        <div className="timeline__actions">
          <button
            type="button"
            className="timeline__act"
            tabIndex={-1}
            disabled={solved || cursor <= 0}
            onClick={() => {
              arrange(moveCard(order, cursor, cursor - 1))
              setCursor((c) => Math.max(0, c - 1))
            }}
          >
            Earlier
          </button>
          <button
            type="button"
            className="timeline__act"
            tabIndex={-1}
            disabled={solved || cursor >= order.length - 1}
            onClick={() => {
              arrange(moveCard(order, cursor, cursor + 1))
              setCursor((c) => Math.min(order.length - 1, c + 1))
            }}
          >
            Later
          </button>
          <button type="button" className="timeline__act" tabIndex={-1} disabled={solved} onClick={confirm}>
            Judge the log
          </button>
        </div>

        {solved && (
          <p className="timeline__replay watchlog__verdict">
            <strong>The gap:</strong> {CASE_2_WATCH_GAP.text} It was the watch of{' '}
            <strong>{CASE_2_SUSPECTS[CASE_2_WATCH_GAP.keeper]}</strong>.
          </p>
        )}
      </div>
    </MinigameShell>
  )
}
