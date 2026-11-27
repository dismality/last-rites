// The keeper thinking aloud (narrationStore): one line at a time, low in the middle of the screen,
// above every overlay so it reads over the ledger, the journal and the altar too. Each line stays
// for `lineSeconds`, or for as long as its recording runs if that is longer; a click on it, or the
// Skip key (Space), cuts it short and moves on to the next line. Lines with a recording (voice/keeper-*.ogg, keeperVoiceFor) are read aloud; a new line, a
// click or leaving the game cuts the one playing. With no file the line is silent, as before. It
// is part of the story, so it shows even with Subtitles off.
import { useEffect, useState } from 'react'
import { playRecorded } from '../../audio/AudioManager'
import { sampleBuffer } from '../../audio/samples'
import { keeperVoiceFor } from '../../data/keeperVoice'
import { useGameStore } from '../../game/state/gameStore'
import { useSettingsStore } from '../../game/state'
import { useIntroStore } from '../../game/state/introStore'
import { isMenuOpen } from '../../game/state/menuState'
import { keyLabel } from '../../game/systems/interaction'
import { lineSeconds, useNarrationStore } from '../../game/state/narrationStore'
import './keeperNarration.css'

/** Breath left after a recording ends before the next line. */
const AFTER_VOICE_S = 0.5

/** Keys pressed here belong to the control: typing a name, or a focused button or select. */
const ownsKeys = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))

export function KeeperNarration() {
  const line = useNarrationStore((s) => s.queue[0] ?? null)
  const left = useNarrationStore((s) => s.queue.length)
  const screen = useGameStore((s) => s.screen)
  const skipKey = useSettingsStore((s) => s.bindings.Skip)
  // Over a menu or panel (the journal, the altar, a minigame) the line still reads, but clicks go
  // through it to the buttons below; Space still skips it (playtest, 2026-11-28: it sat over the
  // altar panel's Close button).
  const [overUi, setOverUi] = useState(false)
  useEffect(() => {
    if (line === null) return
    let id = 0
    const tick = () => {
      setOverUi(isMenuOpen())
      id = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(id)
  }, [line])

  useEffect(() => {
    if (line === null || screen !== 'game') return
    const name = keeperVoiceFor(line)
    const voice = name ? playRecorded(name) : null
    const spoken = voice && name ? (sampleBuffer(name)?.duration ?? 0) + AFTER_VOICE_S : 0
    const t = window.setTimeout(
      () => useNarrationStore.getState().next(),
      Math.max(lineSeconds(line), spoken) * 1000,
    )
    return () => {
      window.clearTimeout(t)
      voice?.stop()
    }
  }, [line, screen])

  // The Skip key cuts the line on screen short (and its recording) and goes to the next one.
  useEffect(() => {
    if (line === null || screen !== 'game') return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.code !== useSettingsStore.getState().bindings.Skip) return
      // The intro and the pause menu own the key while they are up; so does a focused control.
      if (useIntroStore.getState().playing || useGameStore.getState().paused || ownsKeys(e.target)) return
      e.preventDefault()
      useNarrationStore.getState().next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [line, screen])

  // A new run or leaving the game drops what was waiting.
  useEffect(() => {
    if (screen !== 'game') useNarrationStore.getState().clear()
  }, [screen])

  if (line === null || screen !== 'game') return null
  return (
    <div className={`keeper-say${overUi ? ' keeper-say--over-ui' : ''}`} role="status" aria-live="polite">
      <button
        type="button"
        className="keeper-say__line"
        tabIndex={overUi ? -1 : undefined}
        onClick={() => useNarrationStore.getState().next()}
      >
        <span className="keeper-say__who">The keeper</span>
        <span key={line} className="keeper-say__text">
          {line}
        </span>
        {left > 1 && (
          <span className="keeper-say__more" aria-label={`${left - 1} more`}>
            …
          </span>
        )}
        <span className="keeper-say__skip">{keyLabel(skipKey)}: skip</span>
      </button>
    </div>
  )
}
