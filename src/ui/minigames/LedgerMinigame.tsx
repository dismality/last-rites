// Minigame 1a, the Ledger Cross-check (spec 10 task 3.4, Req 12). A two-page spread: the parish
// ledger of 8 entries on the left, rubbings of six readable stones on the right. The player draws
// a line from a stone to its ledger entry (mouse drag, or click and click, or arrows and Enter),
// then flags the mismatch (date, plot or missing certificate) with the Flag button or F.
// The verdict is the pure `ledgerFlags` rule; a wrong flag adds Doubt through the Case_Store and
// says "These two agree". Drawn lines live in the Case_Store, so closing keeps them. No timer.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CASE_1_LEDGER, CASE_1_STONES, type LedgerFlagKind } from '../../data/cases'
import { playPageTurn } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { candidateGraves } from '../../game/systems/caseMinigames'
import {
  applyFlag,
  FLAG_KINDS,
  FLAG_LABEL,
  flagTarget,
  joinLine,
  moveCursor,
  removeLine,
  SOLVED_MESSAGE,
  type Cursor,
} from '../../game/systems/ledgerMinigame'
import type { ResultKind } from '../../game/systems/minigameShell'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'saved-by-the-bell'
const STONE_IDS = CASE_1_STONES.map((s) => s.id)
const ENTRY_IDS = CASE_1_LEDGER.map((e) => e.id)
const KIND_KEYS: Record<string, LedgerFlagKind> = { Digit1: 'date', Digit2: 'plot', Digit3: 'certificate' }
const PAGE_TURN_CAPTION = '[a page turns]'

interface Segment {
  stoneId: string
  x1: number
  y1: number
  x2: number
  y2: number
  flag: LedgerFlagKind | null
}

interface Drag {
  stoneId: string
  x: number
  y: number
}

export function LedgerMinigame() {
  const lines = useCaseStore((s) => s.cases[CASE_ID].ledgerLines)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('1a'))
  const [cursor, setCursor] = useState<Cursor>({ side: 'stone', index: 0 })
  const [selected, setSelected] = useState<string | null>(null)
  const [kind, setKind] = useState<LedgerFlagKind>('date')
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dragFrom, setDragFrom] = useState<{ x: number; y: number } | null>(null)
  const spread = useRef<HTMLDivElement>(null)
  const keyboardMove = useRef(false)

  const cell = useCallback(
    (side: Cursor['side'], index: number) =>
      spread.current?.querySelector<HTMLElement>(
        side === 'stone' ? `[data-stone-id="${STONE_IDS[index]}"]` : `[data-entry-id="${ENTRY_IDS[index]}"]`,
      ) ?? null,
    [],
  )

  // Measure where each line runs: from the stone's left edge to the entry's right edge.
  const measure = useCallback(() => {
    const root = spread.current
    if (!root) return
    const box = root.getBoundingClientRect()
    const out: Segment[] = []
    for (const l of lines) {
      const s = root.querySelector<HTMLElement>(`[data-stone-id="${l.stoneId}"]`)?.getBoundingClientRect()
      const e = root.querySelector<HTMLElement>(`[data-entry-id="${l.ledgerId}"]`)?.getBoundingClientRect()
      if (!s || !e) continue
      out.push({
        stoneId: l.stoneId,
        x1: s.left - box.left,
        y1: s.top + s.height / 2 - box.top,
        x2: e.right - box.left,
        y2: e.top + e.height / 2 - box.top,
        flag: l.flag,
      })
    }
    setSegments(out)
  }, [lines])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    // Web fonts change row heights after the first paint.
    const t = window.setTimeout(measure, 150)
    return () => {
      window.removeEventListener('resize', measure)
      window.clearTimeout(t)
    }
  }, [measure])

  // Focus starts on the first stone (the shell focuses its close button first, so wait a tick).
  useEffect(() => {
    const t = window.setTimeout(() => cell('stone', 0)?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [cell])

  // Arrow keys move focus with the cursor; mouse use never steals it.
  useEffect(() => {
    if (!keyboardMove.current) return
    keyboardMove.current = false
    cell(cursor.side, cursor.index)?.focus()
  }, [cursor, cell])

  const say = (k: ResultKind, text: string) => setResult({ kind: k, text })

  const join = (stoneId: string, ledgerId: string) => {
    if (lines.some((l) => l.stoneId === stoneId && l.ledgerId === ledgerId)) {
      say('info', 'Those two are already joined.')
      return
    }
    useCaseStore.getState().setLedgerLines(joinLine(lines, stoneId, ledgerId))
    playPageTurn()
    setCaptions((c) => [...c, PAGE_TURN_CAPTION])
    setSelected(null)
    say('info', 'Joined. Now flag what does not agree.')
  }

  const flag = (stoneId: string | null) => {
    if (solved) return
    if (!stoneId) return say('info', 'Pick a stone with a line first.')
    const out = applyFlag(lines, stoneId, kind)
    if (out.kind === 'right') {
      useCaseStore.getState().setLedgerLines(out.lines)
      if (out.solved) useCaseStore.getState().submitMinigame('1a', true)
      say('right', out.message)
    } else if (out.kind === 'wrong') {
      useCaseStore.getState().submitMinigame('1a', false)
      say('wrong', out.message)
    } else {
      say('info', out.message)
    }
  }

  const clickStone = (index: number) => {
    const id = STONE_IDS[index]
    setCursor({ side: 'stone', index })
    if (!solved) setSelected(id)
  }

  const clickEntry = (index: number) => {
    const id = ENTRY_IDS[index]
    setCursor({ side: 'entry', index })
    if (solved) return
    if (selected) join(selected, id)
    else {
      const owner = lines.find((l) => l.ledgerId === id)
      if (owner) setSelected(owner.stoneId)
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code.startsWith('Arrow')) {
      e.preventDefault()
      keyboardMove.current = true
      setCursor((c) => moveCursor(c, e.code, STONE_IDS.length, ENTRY_IDS.length))
    } else if (e.code === 'KeyF') {
      e.preventDefault()
      flag(flagTarget(lines, cursor, STONE_IDS, ENTRY_IDS, selected))
    } else if (KIND_KEYS[e.code]) {
      setKind(KIND_KEYS[e.code])
    } else if ((e.code === 'Delete' || e.code === 'Backspace') && !solved) {
      const id = flagTarget(lines, cursor, STONE_IDS, ENTRY_IDS, null)
      if (id) {
        useCaseStore.getState().setLedgerLines(removeLine(lines, id))
        say('info', 'Line rubbed out.')
      }
    }
  }

  // Mouse drag from a stone to an entry; releasing anywhere else cancels.
  const local = (e: PointerEvent | globalThis.PointerEvent) => {
    const box = spread.current?.getBoundingClientRect()
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) }
  }
  const startDrag = (e: PointerEvent, index: number) => {
    if (solved || e.button !== 0) return
    const stoneId = STONE_IDS[index]
    const s = cell('stone', index)?.getBoundingClientRect()
    const box = spread.current?.getBoundingClientRect()
    if (!s || !box) return
    setDragFrom({ x: s.left - box.left, y: s.top + s.height / 2 - box.top })
    setDrag({ stoneId, ...local(e) })
  }
  useEffect(() => {
    if (!drag) return
    const move = (e: globalThis.PointerEvent) => setDrag((d) => (d ? { ...d, ...local(e) } : d))
    const up = (e: globalThis.PointerEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-entry-id]')
      const entryId = target?.dataset.entryId
      if (entryId) {
        setCursor({ side: 'entry', index: ENTRY_IDS.indexOf(entryId) })
        join(drag.stoneId, entryId)
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // `join` and `local` read current state; the listeners are rebuilt whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, lines])

  const graves = candidateGraves().map((id) => CASE_1_STONES.find((s) => s.id === id)?.name ?? id)

  return (
    <MinigameShell id="1a" title="Ledger Cross-check" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
      <p className="ledger__intro">
        Join each stone to its line in the parish ledger, then flag what does not agree. Arrow keys move,
        Enter joins, F flags, 1 2 3 choose the kind, Delete rubs out a line.
      </p>
      <div className="ledger__spread" ref={spread}>
        <section className="ledger__page ledger__page--left" aria-label="Parish ledger">
          <h3 className="ledger__heading">Parish ledger</h3>
          <ul className="ledger__list">
            {CASE_1_LEDGER.map((entry, i) => {
              const line = lines.find((l) => l.ledgerId === entry.id)
              const here = cursor.side === 'entry' && cursor.index === i
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="ledger__cell ledger__cell--entry"
                    data-entry-id={entry.id}
                    tabIndex={here ? 0 : -1}
                    aria-pressed={!!line}
                    onClick={() => clickEntry(i)}
                  >
                    <strong>{entry.name}</strong>
                    <span>
                      {entry.date} · {entry.plot}
                    </span>
                    <span>
                      {entry.cause}, {entry.doctor} · {entry.certificate ? 'Certificate cited' : 'No certificate cited'}
                    </span>
                    {line && <span className="ledger__tag">Joined to {CASE_1_STONES.find((s) => s.id === line.stoneId)?.name}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="ledger__page ledger__page--right" aria-label="Rubbings of the stones">
          <h3 className="ledger__heading">Rubbings</h3>
          <ul className="ledger__list">
            {CASE_1_STONES.map((stone, i) => {
              const line = lines.find((l) => l.stoneId === stone.id)
              const here = cursor.side === 'stone' && cursor.index === i
              return (
                <li key={stone.id}>
                  <button
                    type="button"
                    className={`ledger__cell ledger__cell--stone${selected === stone.id ? ' is-selected' : ''}`}
                    data-stone-id={stone.id}
                    tabIndex={here ? 0 : -1}
                    aria-pressed={selected === stone.id}
                    onClick={() => clickStone(i)}
                    onPointerDown={(e) => startDrag(e, i)}
                  >
                    <strong>{stone.name}</strong>
                    <span>
                      {stone.date} · {stone.plot}
                    </span>
                    {line && (
                      <span className="ledger__tag">
                        {line.flag ? `✦ Flagged: ${FLAG_LABEL[line.flag]}` : '○ Joined, not flagged'}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <svg className="ledger__strings" aria-hidden="true">
          {segments.map((s) => (
            <g key={s.stoneId}>
              <line
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                className={s.flag ? 'ledger__line ledger__line--flagged' : 'ledger__line'}
              />
              {s.flag && (
                <text x={(s.x1 + s.x2) / 2} y={(s.y1 + s.y2) / 2 - 4} textAnchor="middle" className="ledger__line-label">
                  ✦ {FLAG_LABEL[s.flag]}
                </text>
              )}
            </g>
          ))}
          {drag && dragFrom && (
            <line x1={dragFrom.x} y1={dragFrom.y} x2={drag.x} y2={drag.y} className="ledger__line ledger__line--drag" />
          )}
        </svg>
      </div>

      <div className="ledger__flags" role="group" aria-label="Kind of mismatch">
        {FLAG_KINDS.map((k, i) => (
          <button
            key={k}
            type="button"
            className="ledger__kind"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {kind === k ? '◉' : '○'} {i + 1} {FLAG_LABEL[k]}
          </button>
        ))}
        <button
          type="button"
          className="ledger__flag"
          disabled={solved}
          onClick={() => flag(flagTarget(lines, cursor, STONE_IDS, ENTRY_IDS, selected))}
        >
          Flag mismatch (F)
        </button>
      </div>

      {solved && (
        <p className="ledger__solved">
          ✦ {SOLVED_MESSAGE} Candidate graves: {graves.join(', ')}.
        </p>
      )}
      </div>
    </MinigameShell>
  )
}
