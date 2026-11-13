// Journal "Case" tab: a cork board of pinned clue cards joined by red string, the case's
// Final_Question, and the hint tiers. Rules live in the case systems and caseStore; this file
// only reads them and calls store actions. The question is filled here by day and given at the altar.
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { caseOfStage } from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { economy } from '../../game/state/economyPort'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useStageStore } from '../../game/state/stageStore'
import { earnedNotes } from '../../game/systems/caseBoard'
import {
  curseView,
  hintRows,
  layoutCards,
  linkMessage,
  pickCard,
  questionSegments,
  stringViews,
  type Pt,
} from './caseBoardView'
import { ClueCard } from './ClueCard'
import { RedString } from './RedString'

/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_START_PX = 6

interface Drag {
  id: string
  x: number
  y: number
  active: boolean
}

export function CaseBoard() {
  const stage = useStageStore((s) => s.stage)
  const def = caseOfStage(stage)
  const progress = useCaseStore((s) => s.cases[def.id])
  const coins = useProgressionStore((s) => s.coins)
  const nightElapsed = useStageStore((s) => s.nightElapsed)

  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<{ from: Pt; to: Pt } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  const found = useMemo(() => new Set(progress.found), [progress.found])
  const shown = useMemo(() => def.clues.filter((c) => found.has(c.id)), [def, found])
  const cards = useMemo(() => layoutCards(shown, def.clues), [shown, def])
  const strings = useMemo(() => stringViews(progress.links, def, cards), [progress.links, def, cards])
  const notes = earnedNotes({ links: progress.links }, def)
  const curse = curseView(progress.links, def)
  const titleOf = (id: string) => def.clues.find((c) => c.id === id)?.title ?? id
  const hints = hintRows(def, progress.hints, coins, nightElapsed, economy().story())

  const tryLink = (a: string, b: string) => {
    const r = useCaseStore.getState().link(a, b)
    setMessage(linkMessage(titleOf, a, b, r))
  }

  const onPick = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const r = pickCard(selected, id)
    setSelected(r.selected)
    if (r.link) tryLink(r.link.a, r.link.b)
    else if (r.selected) setMessage(`${titleOf(id)} selected. Pick the card it belongs with.`)
    else setMessage('Selection cleared.')
  }

  const toBoard = (clientX: number, clientY: number): Pt => {
    const r = boardRef.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 }
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 }
  }

  const onCardDown = (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    dragRef.current = { id, x: e.clientX, y: e.clientY, active: false }
  }

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START_PX) return
    d.active = true
    const from = cards.find((c) => c.clue.id === d.id)?.at
    if (from) setDrag({ from, to: toBoard(e.clientX, e.clientY) })
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d?.active) return
    // The press was a drag, so the click that follows must not also select the card.
    // A click only follows when the press ends on the same card. Ending on another card (a link) or on
    // the cork fires none, so the flag is cleared at once and cannot swallow the player's next click.
    suppressClick.current = true
    setTimeout(() => {
      suppressClick.current = false
    }, 0)
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-clue-id]')
    const target = over?.dataset.clueId
    if (target && target !== d.id) {
      setSelected(null)
      tryLink(d.id, target)
    }
  }

  const buyHint = () => {
    const buy = useCaseStore.getState().useHint
    const r = buy()
    if (r.ok) setMessage(r.cost === 0 ? `Hint ${r.tier} revealed for free.` : `Hint ${r.tier} revealed for ${r.cost} Grave Coins.`)
    else if (r.reason === 'coins') setMessage(`Not enough Grave Coins: the hint costs ${r.cost}.`)
    else setMessage('Every hint is already revealed.')
  }

  const linkCountOf = (id: string) => strings.filter((s) => s.a === id || s.b === id).length

  return (
    <section className="case-board" aria-label={`Case: ${def.title}`}>
      <header className="case-board__head">
        <h3 className="case-board__title">{def.title}</h3>
        <p className="case-board__clues">
          Clues pinned: {shown.length} of {def.clues.length}
        </p>
        <div className="case-curse" role="img" aria-label={curse.label}>
          <span className="case-curse__label">{curse.label}</span>
          <span className="case-curse__bar" aria-hidden="true">
            <span className="case-curse__fill" style={{ width: `${curse.fraction * 100}%` }} />
          </span>
        </div>
      </header>

      <p className="case-board__help">
        Drag from one card to another, or select a card and press Enter on a second. A solid string with ✓ is a true
        connection; a dashed string with ✗ joins nothing yet.
      </p>

      <div
        ref={boardRef}
        className="case-cork"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <RedString strings={strings} pending={drag} />
        {cards.map((c) => (
          <ClueCard
            key={c.clue.id}
            view={c}
            selected={selected === c.clue.id}
            linkCount={linkCountOf(c.clue.id)}
            onPick={onPick}
            onPointerDown={onCardDown}
          />
        ))}
        {shown.length === 0 && (
          <p className="case-cork__empty">The board is bare. Clues pin themselves here as you find them.</p>
        )}
      </div>

      <div className="case-note" role="status" aria-live="polite">
        {message || 'Link two cards to test an idea.'}
      </div>

      {notes.length > 0 && (
        <ul className="case-notes" aria-label="Deductions">
          {notes.map((n) => (
            <li key={`${n.a}|${n.b}`}>{n.text}</li>
          ))}
        </ul>
      )}

      <div className="case-final">
        <h4 className="case-final__title">The question</h4>
        <p className="case-final__sentence">
          {questionSegments(def.final).map((seg, i) => {
            if (seg.kind === 'text') return <span key={i}>{seg.text}</span>
            const slot = seg.slot ?? 0
            const def_ = def.final.slots[slot]
            return (
              <select
                key={i}
                className="case-final__slot"
                aria-label={`${def_.label}, slot ${slot + 1} of ${def.final.slots.length}`}
                value={progress.slots[slot] ?? ''}
                onChange={(e) => useCaseStore.getState().fillSlot(slot, e.target.value || null)}
              >
                <option value="">(empty)</option>
                {def_.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )
          })}
        </p>
        <p className="case-final__altar">Fill the blanks here. You answer at the altar, by night.</p>
      </div>

      <div className="case-hints">
        <h4 className="case-final__title">Hints</h4>
        <p className="case-hints__coins">Grave Coins: {coins}</p>
        <ol className="case-hints__list">
          {hints.map((h) => (
            <li key={h.tier} className={`case-hint case-hint--${h.state}`}>
              {h.state === 'revealed' && (
                <p className="case-hint__text">
                  <strong>Hint {h.tier}.</strong> {h.text}
                </p>
              )}
              {h.state !== 'revealed' && (
                <>
                  <button
                    type="button"
                    className="case-hint__buy"
                    disabled={!h.canBuy}
                    aria-describedby={h.why ? `case-hint-why-${h.tier}` : undefined}
                    onClick={buyHint}
                  >
                    {h.label}
                  </button>
                  {h.why && (
                    <span id={`case-hint-why-${h.tier}`} className="case-hint__why">
                      {h.why}
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
