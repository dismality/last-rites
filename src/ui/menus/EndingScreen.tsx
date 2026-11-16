import { useEffect, useId, useMemo, useState } from 'react'
import creditsMarkdown from '../../../docs/CREDITS.md?raw'
import { ENDING_MAP, JUSTICE_EPILOGUE } from '../../data/endings'
import { useAccusationStore } from '../../game/state/accusationStore'
import { useEndingStore } from '../../game/state/endingStore'
import { useCraftingStore } from '../../game/state/craftingStore'
import { useIntroStore } from '../../game/state/introStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { startRun } from '../../game/state/progressionActions'
import { useGameStore } from '../../game/state/gameStore'
import { resetRun } from '../../game/state/resetRun'
import { parseCredits } from '../../game/systems/credits'
import { defaultLine } from '../../game/systems/accusation'
import { activeLine, fadeAlpha, handleEpilogueKey, handleSkipKey } from '../../game/systems/endingSequence'
import { endingCameraRuntime } from '../../scene/effects/endingCameraRuntime'
import { MODES } from '../../data/modes'
import type { ModeId } from '../../game/types'
import { MenuDialog } from './MenuDialog'
import { ModeSelect } from './ModeSelect'
import { StatsPanel } from './StatsPanel'
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
      handleSkipKey(e, showSummary)
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

/** Justice for Elias: read before the walk-out. Space or Enter go on; Esc still pauses. */
function Epilogue() {
  const endEpilogue = useEndingStore((s) => s.endEpilogue)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleEpilogueKey(e, endEpilogue)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [endEpilogue])

  return (
    <div className="ending ending--epilogue" data-ending="rest">
      <section className="ending__epilogue" role="status" aria-live="polite" aria-label="Justice for Elias">
        <h2 className="ending__epilogue-title">Justice for Elias</h2>
        {JUSTICE_EPILOGUE.map((line) => (
          <p key={line} className="ending__epilogue-line">
            {line}
          </p>
        ))}
        <button type="button" className="menu__button" autoFocus onClick={endEpilogue}>
          Walk out (Space)
        </button>
      </section>
    </div>
  )
}

function Summary() {
  const titleId = useId()
  const ending = useEndingStore((s) => s.ending)
  const modeSelectOpen = useOverlayStore((s) => s.modeSelectOpen)
  const setModeSelectOpen = useOverlayStore((s) => s.setModeSelectOpen)
  const setScreen = useGameStore((s) => s.setScreen)
  const credits = useMemo(() => parseCredits(creditsMarkdown), [])
  const accusation = useAccusationStore((s) => s.record)

  if (!ending) return null
  const def = ENDING_MAP[ending]

  // startRun resets the run itself, so the starting recipes and the screen are set after it.
  function beginMode(mode: ModeId) {
    startRun(mode)
    setModeSelectOpen(false)
    useGameStore.getState().setPaused(false)
    useCraftingStore.getState().applyUnlockEvent({ type: 'gameStart' })
    if (MODES[mode].story) useIntroStore.getState().begin()
    setScreen('game')
  }

  if (modeSelectOpen) {
    return <ModeSelect onBegin={beginMode} onBack={() => setModeSelectOpen(false)} />
  }

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
      {/* Only a won run has the Silas line: the accusation never changes whether it is won (Req 18.5). */}
      {ending === 'rest' && defaultLine(accusation) && <p className="ending__silas">{defaultLine(accusation)}</p>}
      <StatsPanel onClose={toTitle} />
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
        <button type="button" className="menu__button" onClick={() => setModeSelectOpen(true)}>
          New Game
        </button>
      </div>
    </MenuDialog>
  )
}

export function EndingScreen() {
  const screen = useGameStore((s) => s.screen)
  const stage = useEndingStore((s) => s.stage)
  if (screen !== 'ending') return null
  if (stage === 'epilogue') return <Epilogue />
  return stage === 'sequence' ? <Sequence /> : <Summary />
}
