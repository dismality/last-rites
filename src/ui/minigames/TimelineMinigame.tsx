// Minigame 3b, Elias's Last Night (spec 10 task 4.4, Req 16). Six evidence cards, found by walking
// (the dry boots, the letter, the ruts, the oil, the pin and the nail marks), go on a midnight-to-
// dawn timeline. The pure `evidenceTimeline` rule judges the order. A wrong order adds Doubt through
// the Case_Store and marks the first card out of place with a glyph and words; the right one solves
// 3b, replays the night in captioned beats and, in the world, pulls the pin and opens the crypt.
// Mouse: drag a card to a place. Keyboard alone: Left/Right choose a card, Space lifts it, Left/Right
// move it, Space puts it down, Enter judges. There is no timer. The arrangement is kept in the
// Case_Store when the overlay closes. Card times are not shown: the order is for the player to find.
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  CASE_3_BOOTS_CLUE,
  CASE_3_EVIDENCE,
  CASE_3_TIMELINE_ORDER,
  type EvidenceCardDef,
  type EvidenceCardId,
} from '../../data/cases'
import { CAPTION_MAP } from '../../data/captions'
import { useCaseStore } from '../../game/state/caseStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { evidenceTimeline } from '../../game/systems/caseMinigames'
import type { ResultKind } from '../../game/systems/minigameShell'
import {
  cardAt,
  heldCards,
  moveCard,
  replayBeats,
  syncTimeline,
  timelineKey,
  timelineReady,
} from '../../game/systems/timelineMinigame'
import { MinigameShell } from './MinigameShell'

const CASE_ID = 'sealed-catacombs'
const SLOTS = CASE_3_TIMELINE_ORDER.length
/** Time between replayed beats. Only the pace of the captions; nothing is timed against the player. */
const BEAT_MS = 1400

const CARD_MAP: Readonly<Record<EvidenceCardId, EvidenceCardDef>> = Object.fromEntries(
  CASE_3_EVIDENCE.map((c) => [c.id, c]),
) as Record<EvidenceCardId, EvidenceCardDef>

export function TimelineMinigame() {
  const found = useCaseStore((s) => s.cases[CASE_ID].evidenceFound)
  const saved = useCaseStore((s) => s.cases[CASE_ID].timeline)
  const solved = useCaseStore((s) => s.cases[CASE_ID].minigames.includes('3b'))
  const bootsFound = useMysteryStore((s) => s.mystery.clues.has(CASE_3_BOOTS_CLUE))
  const held = heldCards(found, bootsFound)

  const [order, setOrder] = useState<EvidenceCardId[]>(() => syncTimeline(saved, held))
  const [cursor, setCursor] = useState(0)
  const [lifted, setLifted] = useState(false)
  const [outOfPlace, setOutOfPlace] = useState<EvidenceCardId | null>(null)
  const [result, setResult] = useState<{ kind: ResultKind; text: string } | null>(null)
  const [captions, setCaptions] = useState<string[]>([])
  const dragFrom = useRef<number | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  // The shell focuses its close button first, so take focus on the next tick.
  useEffect(() => {
    const t = window.setTimeout(() => area.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  // Keep the stored arrangement in step with what the player holds, so a card found later joins it.
  useEffect(() => {
    useCaseStore.getState().setTimeline(order)
  }, [order])

  const say = (kind: ResultKind, text: string) => setResult({ kind, text })
  const arrange = (next: EvidenceCardId[]) => {
    setOrder(next)
    setOutOfPlace(null)
    setResult(null)
  }

  const replay = () => {
    replayBeats().forEach((beat, i) => {
      timers.current.push(window.setTimeout(() => setCaptions((c) => [...c, beat]), i * BEAT_MS))
    })
  }

  const confirm = () => {
    if (solved) return say('info', "Elias's night is already in order.")
    if (!timelineReady(order)) {
      return say('info', `Find all six pieces of evidence first. You hold ${order.length} of ${SLOTS}.`)
    }
    const verdict = evidenceTimeline(order)
    if (!verdict.ok) {
      useCaseStore.getState().submitMinigame('3b', false)
      const bad = cardAt(order, verdict.firstWrong)
      setOutOfPlace(bad)
      if (verdict.firstWrong !== undefined) setCursor(verdict.firstWrong)
      return say('wrong', `That is not how the night went. "${bad ? CARD_MAP[bad].title : 'A card'}" is out of place.`)
    }
    useCaseStore.getState().submitMinigame('3b', true)
    setCaptions((c) => [...c, CAPTION_MAP['crypt-pin-pulled'].text])
    replay()
    say('right', 'Elias was sealed in alive. You pull the pin, and the crypt door swings open.')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) return
    if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return
    e.preventDefault()
    const r = timelineKey({ cursor, lifted, order }, e.code)
    setCursor(r.cursor)
    setLifted(r.lifted)
    if (r.order !== order && r.order.some((id, i) => id !== order[i])) arrange(r.order)
    if (r.confirm) confirm()
  }

  const onDrop = (to: number) => (e: DragEvent) => {
    e.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    if (from === null || to >= order.length) return
    arrange(moveCard(order, from, to))
    setCursor(to)
  }

  const beats = replayBeats()

  return (
    <MinigameShell id="3b" title="Elias's Last Night" captions={captions} result={result}>
      <div onKeyDown={onKeyDown}>
        <p className="timeline__intro">
          Six things tell how Elias spent his last night. Put them in order, from midnight to dawn. Drag a card,
          or use Left and Right to choose one, Space to lift it, Left and Right to move it, Space to set it
          down, and Enter to judge. You hold {order.length} of {SLOTS}.
        </p>

        <div className="timeline__ends" aria-hidden="true">
          <span>☾ Midnight</span>
          <span>Dawn ☼</span>
        </div>

        <div
          ref={area}
          className="timeline__track"
          tabIndex={0}
          role="group"
          aria-label={`Timeline from midnight to dawn. ${
            order[cursor] ? `Card ${cursor + 1} of ${order.length}: ${CARD_MAP[order[cursor]].title}${lifted ? ', lifted' : ''}` : 'No cards yet'
          }`}
        >
          {Array.from({ length: SLOTS }, (_, i) => {
            const id = order[i]
            if (!id) {
              return (
                <div
                  key={`empty-${i}`}
                  className="timeline__slot timeline__slot--empty"
                  aria-label={`Place ${i + 1}: empty`}
                >
                  <span className="timeline__no">{i + 1}</span>
                  <span className="timeline__blank">Not found yet</span>
                </div>
              )
            }
            const card = CARD_MAP[id]
            const bad = outOfPlace === id
            return (
              <div
                key={id}
                className="timeline__slot"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop(i)}
              >
                <span className="timeline__no">{i + 1}</span>
                <button
                  type="button"
                  className="timeline__card"
                  draggable={!solved}
                  tabIndex={-1}
                  aria-pressed={i === cursor}
                  data-lifted={i === cursor && lifted ? 'true' : undefined}
                  data-wrong={bad ? 'true' : undefined}
                  data-card={id}
                  aria-label={`${card.title}${bad ? ', out of place' : ''}`}
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
                  <span className="timeline__title">
                    {i === cursor ? (lifted ? '⇅ ' : '▸ ') : ''}
                    {card.title}
                  </span>
                  <span className="timeline__text">{card.text}</span>
                  {bad && <span className="timeline__flag">✕ Out of place</span>}
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
            disabled={solved || order.length === 0 || cursor <= 0}
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
            disabled={solved || order.length === 0 || cursor >= order.length - 1}
            onClick={() => {
              arrange(moveCard(order, cursor, cursor + 1))
              setCursor((c) => Math.min(order.length - 1, c + 1))
            }}
          >
            Later
          </button>
          <button type="button" className="timeline__act" tabIndex={-1} disabled={solved} onClick={confirm}>
            Judge the night (Enter)
          </button>
        </div>

        {solved && (
          <section className="timeline__replay" aria-label="The night as it happened">
            <h3 className="timeline__heading">The night as it happened</h3>
            <ol>
              {beats.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </MinigameShell>
  )
}
