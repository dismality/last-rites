import { useEffect, useId, useMemo, useState } from 'react'
import creditsMarkdown from '../../../docs/CREDITS.md?raw'
import { CLUES } from '../../data/clues'
import { ENDING_MAP } from '../../data/endings'
import { useEndingStore } from '../../game/state/endingStore'
import { useGameStore } from '../../game/state/gameStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { resetRun } from '../../game/state/resetRun'
import { newGame } from '../../game/state/runFlow'
import { parseCredits } from '../../game/systems/credits'
import { activeLine, fadeAlpha } from '../../game/systems/endingSequence'
import { countRelics } from '../../game/systems/finalRite'
import { summaryRows } from '../../game/systems/runStats'
import { endingCameraRuntime } from '../../scene/effects/endingCameraRuntime'
import { MenuDialog } from './MenuDialog'
import './menus.css'

/** Subtitled camera sequence: the closing lines are the narration, so they always show. */
function Sequence() {
  const ending = useEndingStore((s) => s.ending)
  const showSummary = useEndingStore((s) => s.showSummary)
  const def = ending ? ENDING_MAP[ending] : null
  const [line, setLine] = useState('')
  const [fade, setFade] = useState(1)

  useEffect(() => {
    if (!def) return
    let raf = 0
    const poll = () => {
      const t = endingCameraRuntime.time
      setLine(activeLine(def, t)?.text ?? '')
      // Quantised so React re-renders a few times a second, not every frame.
      setFade(Math.round(fadeAlpha(def, t) * 20) / 20)
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [def])

  // Escape skips; the button does the same for pointer users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') showSummary()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSummary])

  if (!def) return null
  return (
    <div className="ending" data-ending={def.id}>
      <div className="ending__fade" style={{ opacity: fade }} aria-hidden="true" />
      <p className="ending__line" role="status" aria-live="polite">
        {line}
      </p>
      <button type="button" className="ending__skip" onClick={showSummary}>
        Skip (Esc)
      </button>
    </div>
  )
}

function Summary() {
  const titleId = useId()
  const ending = useEndingStore((s) => s.ending)
  const stats = useEndingStore((s) => s.stats)
  const inventoryRelics = useInventoryStore((s) => s.inventory.relics)
  const mystery = useMysteryStore((s) => s.mystery)
  const setScreen = useGameStore((s) => s.setScreen)
  const credits = useMemo(() => parseCredits(creditsMarkdown), [])

  if (!ending) return null
  const def = ENDING_MAP[ending]
  const rows = summaryRows(stats, countRelics(inventoryRelics, mystery.relics), mystery.clues.size, CLUES.length)

  function toTitle() {
    resetRun()
    setScreen('title')
  }

  return (
    <MenuDialog titleId={titleId} variant="screen">
      <h2 id={titleId} className="menu__title menu__title--hero">
        {def.title}
      </h2>
      <p className="ending__closing">{def.closingLine}</p>
      <dl className="ending__stats">
        {rows.map((r) => (
          <div key={r.label} className="ending__stat">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <section className="ending__credits" aria-label="Credits" tabIndex={0}>
        <h3 className="ending__credits-title">Credits</h3>
        {credits.map((c, i) =>
          c.kind === 'heading' ? (
            <h4 key={i} className="ending__credits-heading">
              {c.text}
            </h4>
          ) : (
            <p key={i} className="ending__credits-line">
              {c.text}
            </p>
          ),
        )}
      </section>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={newGame}>
          New Game
        </button>
        <button type="button" className="menu__button" onClick={toTitle}>
          Title
        </button>
      </div>
    </MenuDialog>
  )
}

export function EndingScreen() {
  const screen = useGameStore((s) => s.screen)
  const stage = useEndingStore((s) => s.stage)
  if (screen !== 'ending') return null
  return stage === 'sequence' ? <Sequence /> : <Summary />
}
