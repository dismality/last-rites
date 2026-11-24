// The keeper thinking aloud (narrationStore): one line at a time, low in the middle of the screen,
// above every overlay so it reads over the ledger, the journal and the altar too. Each line stays
// for `lineSeconds`, or for as long as its recording runs if that is longer; a click on it moves
// on. Lines with a recording (voice/keeper-*.ogg, keeperVoiceFor) are read aloud; a new line, a
// click or leaving the game cuts the one playing. With no file the line is silent, as before. It
// is part of the story, so it shows even with Subtitles off.
import { useEffect } from 'react'
import { playRecorded } from '../../audio/AudioManager'
import { sampleBuffer } from '../../audio/samples'
import { keeperVoiceFor } from '../../data/case1Narration'
import { useGameStore } from '../../game/state/gameStore'
import { lineSeconds, useNarrationStore } from '../../game/state/narrationStore'
import './keeperNarration.css'

/** Breath left after a recording ends before the next line. */
const AFTER_VOICE_S = 0.5

export function KeeperNarration() {
  const line = useNarrationStore((s) => s.queue[0] ?? null)
  const left = useNarrationStore((s) => s.queue.length)
  const screen = useGameStore((s) => s.screen)

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

  // A new run or leaving the game drops what was waiting.
  useEffect(() => {
    if (screen !== 'game') useNarrationStore.getState().clear()
  }, [screen])

  if (line === null || screen !== 'game') return null
  return (
    <div className="keeper-say" role="status" aria-live="polite">
      <button
        type="button"
        className="keeper-say__line"
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
      </button>
    </div>
  )
}
