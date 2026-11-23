// Journal "Case" tab: a cork board of pinned clue cards joined by red string, the case's
// Final_Question, and the hint tiers. Rules live in the case systems and caseStore; this file
// only reads them and calls store actions. The question is filled here by day and given at the altar.
import { InfoDot } from '../theme/InfoDot'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { caseOfStage } from '../../data/cases'
import { STAGE_DAY_RULES } from '../../data/objectiveRules'
import { usePinStore } from '../../game/state/pinStore'
import { useCaseStore } from '../../game/state/caseStore'
import { economy } from '../../game/state/economyPort'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useStageStore } from '../../game/state/stageStore'
import { earnedNotes, linkKey } from '../../game/systems/caseBoard'
import { nextQuestion } from '../../game/systems/caseQuestions'
import {
  boardStrings,
  curseView,
  hintRows,
  layoutCards,
  linkMessage,
  missingCards,
  pickCard,
  questionSegments,
  stringViews,
  type Pt,
} from './caseBoardView'
import { Case1Findings } from './Case1Findings'
import { ClueCard } from './ClueCard'
import { MissingCard } from './MissingCard'
import { RedString } from './RedString'

/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_START_PX = 6
/** How long a wrong string sags on the board before it falls away (ms). */
const WRONG_FALL_MS = 2200

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
  // A wrong pair's string: drawn sagging, then gone (playtest 11r).
  const [falling, setFalling] = useState<string | null>(null)
  useEffect(() => {
    if (!falling) return
    const t = setTimeout(() => setFalling(null), WRONG_FALL_MS)
    return () => clearTimeout(t)
  }, [falling])
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(false)

  const found = useMemo(() => new Set(progress.found), [progress.found])
  const shown = useMemo(() => def.clues.filter((c) => found.has(c.id)), [def, found])
  const cards = useMemo(() => layoutCards(shown, def.clues), [shown, def])
  const backs = useMemo(
    () => missingCards(def.clues, found, STAGE_DAY_RULES[stage]),
    [def, found, stage],
  )
  const allStrings = useMemo(
    () => stringViews(progress.links, def, cards),
    [progress.links, def, cards],
  )
  const strings = useMemo(() => boardStrings(allStrings, falling), [allStrings, falling])
  const notes = earnedNotes({ links: progress.links }, def)
  const curse = curseView(progress.links, def)
  const titleOf = (id: string) => def.clues.find((c) => c.id === id)?.title ?? id
  const ask = nextQuestion(def, found, progress.links, titleOf)
  const about = ask.kind === 'ask' ? ask.question.about : null
  const hints = hintRows(def, progress.hints, coins, nightElapsed, economy().story())
  // Case 1 has no strings to draw: its journal page walks the findings and asks one question.
  const linking = def.notes.length > 0

  const tryLink = (a: string, b: string) => {
    const key = linkKey(a, b)
    const triedWrong = allStrings.some((s) => s.key === key && !s.correct)
    const r = useCaseStore.getState().link(a, b)
    if (r.added && !r.note) setFalling(key)
    setMessage(linkMessage(titleOf, a, b, r, triedWrong))
  }

  const onPick = (id: string) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    // With a question open, a click answers it: the card is tried against the one asked about.
    if (about) {
      if (id === about)
        setMessage('That is the card the question is about. Click the card that answers it.')
      else tryLink(about, id)
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
    const over = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-clue-id]')
    const target = over?.dataset.clueId
    if (target && target !== d.id) {
      setSelected(null)
      tryLink(d.id, target)
    }
  }

  const buyHint = () => {
    const buy = useCaseStore.getState().useHint
    const r = buy()
    if (r.ok)
      setMessage(
        r.cost === 0
          ? `Hint ${r.tier} revealed for free.`
          : `Hint ${r.tier} revealed for ${r.cost} Grave Coins.`,
      )
    else if (r.reason === 'coins') setMessage(`Not enough Grave Coins: the hint costs ${r.cost}.`)
    else setMessage('Every hint is already revealed.')
  }

  const linkCountOf = (id: string) => strings.filter((s) => s.a === id || s.b === id).length

  return (
    <section className="case-board" aria-label={`Case: ${def.title}`}>
      <header className="case-board__head">
        <div className="info-row">
          <h3 className="case-board__title">{def.title}</h3>
          <InfoDot tipKey="hud-case-board" label="About the case board" />
        </div>
        <p className="case-board__clues">
          Clues pinned: {shown.length} of {def.clues.length}
          <InfoDot tipKey="hud-clues" label="About clues" />
        </p>
        {linking && (
          <div className="case-curse" role="img" aria-label={curse.label}>
            <span className="case-curse__label">{curse.label}</span>
            <InfoDot tipKey="hud-curse" label="About the Curse meter" />
            <span className="case-curse__bar" aria-hidden="true">
              <span className="case-curse__fill" style={{ width: `${curse.fraction * 100}%` }} />
            </span>
          </div>
        )}
      </header>

      {!linking && <Case1Findings />}

      {linking && (
        <div className="case-question" role="status" aria-live="polite">
          {ask.kind === 'ask' ? (
            <>
              <p className="case-question__count">
                Question {ask.question.number} of {ask.question.total}
              </p>
              <p className="case-question__text">{ask.question.text}</p>
              <p className="case-question__how">
                The card it is about is marked. <strong>Click the card that answers it.</strong>{' '}
                Wrong guesses cost nothing.
              </p>
            </>
          ) : ask.kind === 'wait' ? (
            <p className="case-question__text">
              {ask.left === 1 ? 'One question is' : `${ask.left} questions are`} left, but a clue it
              needs is not found yet. The face-down cards say where to look.
            </p>
          ) : (
            <p className="case-question__text">
              ✓ Every clue is linked. Fill in the question below, then answer at the chapel altar at
              night.
            </p>
          )}
        </div>
      )}

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
            selected={about ? c.clue.id === about : selected === c.clue.id}
            selectedLabel={about ? 'The question is about this card' : undefined}
            linkCount={linkCountOf(c.clue.id)}
            onPick={onPick}
            onPointerDown={onCardDown}
          />
        ))}
        {/* After the real cards, so Tab reaches the clues first. */}
        {backs.map((b) => (
          <MissingCard
            key={b.id}
            view={b}
            onPin={(v) => {
              if (!v.pin) return
              usePinStore.getState().place(v.pin)
              setMessage(`Pinned on the map: ${v.pin.name}. Open the Map tab to see it.`)
            }}
          />
        ))}
        {shown.length === 0 && backs.length === 0 && (
          <p className="case-cork__empty">
            No clues yet. Each face-down card says where one might be.
          </p>
        )}
      </div>

      {linking && (
        <div className="case-note" role="status" aria-live="polite">
          {message ||
            (about
              ? 'Click the card that answers the question.'
              : 'Link two cards to test an idea.')}
        </div>
      )}

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
        <p className="case-final__altar">
          {def.final.typed
            ? 'You answer at the altar, by night, by typing the name.'
            : 'Fill the blanks here. You answer at the altar, by night.'}
        </p>
      </div>

      <div className="case-hints">
        <div className="info-row">
          <h4 className="case-final__title">Hints</h4>
          <InfoDot tipKey="hud-hints" label="About hints" />
        </div>
        <p className="case-hints__coins">
          Grave Coins: {coins}
          <InfoDot tipKey="hud-coins" label="About Grave Coins" />
        </p>
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
