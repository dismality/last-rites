// Minigame 3a, the Hymn Board (spec 10 task 4.3, Req 15). The board on the chapel's east wall
// shows five hymn numbers; the vestry psalter lists hymns 1 to 60 by title; five brass tiles are
// set to the first letters. Enter confirms: the pure `hymnTiles` rule judges, a wrong setting adds
// Doubt through the Case_Store and shows "The tiles do not sit true", and a right one solves 3a
// and, by day with the whistle held, blows it at the altar so the stair opens. Keyboard only:
// Left/Right choose a tile, Up/Down or a letter key set it, Backspace clears it, Enter confirms.
// The tiles are kept in the Case_Store when the overlay closes.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CASE_3_HYMN_BOARD } from '../../data/cases'
import { CAPTION_MAP } from '../../data/captions'
import { useCaseStore } from '../../game/state/caseStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useWorldStore } from '../../game/state/worldStore'
import { hymnTiles } from '../../game/systems/caseMinigames'
import {
  filledCount,
  letterOfKey,
  moveTile,
  psalterRows,
  setTile,
  stepLetter,
  type HymnTiles,
} from '../../game/systems/hymnMinigame'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'sealed-catacombs'
const ROWS = psalterRows()

export function HymnMinigame() {
  const saved = useCaseStore((s) => s.cases[CASE_ID].hymnTiles)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('3a'))
  const [tiles, setTiles] = useState<HymnTiles>(saved)
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const board = useRef<HTMLDivElement>(null)

  // The shell focuses its close button first, so take focus on the next tick.
  useEffect(() => {
    const t = window.setTimeout(() => board.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })
  const caption = (id: 'hymn-tiles-wrong' | 'hymn-stair-open') => setCaptions((c) => [...c, CAPTION_MAP[id].text])

  const update = (next: HymnTiles) => {
    setTiles(next)
    useCaseStore.getState().setHymnTiles(next)
    setResult(null)
  }

  const confirm = () => {
    if (solved) return say('info', 'The tiles already sit true.')
    if (filledCount(tiles) < tiles.length) return say('info', 'Set all five tiles first.')
    const verdict = hymnTiles(tiles)
    if (!verdict.ok) {
      useCaseStore.getState().submitMinigame('3a', false)
      caption('hymn-tiles-wrong')
      if (verdict.firstWrong !== undefined && verdict.firstWrong < tiles.length) setIndex(verdict.firstWrong)
      return say('wrong', verdict.message ?? 'The tiles do not sit true')
    }
    useCaseStore.getState().submitMinigame('3a', true)
    const hasWhistle = useInventoryStore.getState().inventory.keyItems.includes('bone-whistle')
    // The stair opens by day only, as at the altar itself; the whistle must be held.
    if (hasWhistle && useWorldStore.getState().phase === 'day') {
      const r = useMysteryStore.getState().interactGate('catacombs', 'altar')
      if (r.kind === 'opened') caption('hymn-stair-open')
      return say('right', 'BELOW. You blow the whistle and the stair behind the altar opens.')
    }
    say(
      'right',
      hasWhistle
        ? 'BELOW. The tiles sit true. The stair waits for morning.'
        : "BELOW. The tiles sit true. The sexton's whistle will wake the stair at the altar.",
    )
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault()
      setIndex((i) => moveTile(i, e.code))
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault()
      update(setTile(tiles, index, stepLetter(tiles[index] ?? null, e.code)))
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      e.preventDefault()
      update(setTile(tiles, index, null))
    } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault()
      confirm()
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const letter = letterOfKey(e.code)
      if (letter) {
        e.preventDefault()
        update(setTile(tiles, index, letter))
        setIndex((i) => moveTile(i, 'ArrowRight'))
      }
    }
  }

  return (
    <MinigameShell id="3a" title="The Hymn Board" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="hymn__intro">
          The board names five hymns. Find each in the vestry psalter and set its first letter on the brass
          tiles. Left and Right choose a tile, Up and Down change its letter (or type one), Enter blows the
          whistle.
        </p>

        <div className="hymn__board" aria-label="The hymn board">
          <span className="hymn__board-label">Board:</span>
          <ol className="hymn__numbers">
            {CASE_3_HYMN_BOARD.numbers.map((n, i) => (
              <li key={i} className="hymn__number">
                {n}
              </li>
            ))}
          </ol>
        </div>

        <div
          ref={board}
          className="hymn__tiles"
          tabIndex={0}
          role="group"
          aria-label={`Brass tiles. Tile ${index + 1} of ${tiles.length}, ${tiles[index] ?? 'empty'}`}
        >
          {tiles.map((t, i) => (
            <button
              key={i}
              type="button"
              className="hymn__tile"
              aria-pressed={i === index}
              aria-label={`Tile ${i + 1}: ${t ?? 'empty'}`}
              tabIndex={-1}
              onClick={() => {
                setIndex(i)
                board.current?.focus()
              }}
            >
              {i === index ? '▸' : ''}
              {t ?? '·'}
            </button>
          ))}
        </div>

        <div className="hymn__actions">
          <button type="button" className="hymn__act" tabIndex={-1} onClick={() => update(setTile(tiles, index, stepLetter(tiles[index] ?? null, 'ArrowDown')))}>
            Letter back
          </button>
          <button type="button" className="hymn__act" tabIndex={-1} onClick={() => update(setTile(tiles, index, stepLetter(tiles[index] ?? null, 'ArrowUp')))}>
            Letter on
          </button>
          <button type="button" className="hymn__act" tabIndex={-1} disabled={solved} onClick={confirm}>
            Blow the whistle (Enter)
          </button>
        </div>

        <section className="hymn__psalter" aria-label="The vestry psalter, hymns 1 to 60">
          <h3 className="hymn__heading">The psalter, hymns 1 to 60</h3>
          <ol className="hymn__index">
            {ROWS.map((r) => (
              <li key={r.n} value={r.n}>
                {r.title}
              </li>
            ))}
          </ol>
        </section>

        {solved && <p className="hymn__solved">✦ The tiles sit true: BELOW.</p>}
      </div>
    </MinigameShell>
  )
}
