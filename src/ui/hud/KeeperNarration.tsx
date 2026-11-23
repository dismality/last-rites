// The keeper thinking aloud (narrationStore): one line at a time, low in the middle of the screen,
// above every overlay so it reads over the ledger, the journal and the altar too. Each line stays
// for `lineSeconds`; a click on it moves on. It is part of the story, so it shows even with
// Subtitles off. Reads the store and runs the timer only.
import { useEffect } from 'react'
import { useGameStore } from '../../game/state/gameStore'
import { lineSeconds, useNarrationStore } from '../../game/state/narrationStore'
import './keeperNarration.css'

export function KeeperNarration() {
  const line = useNarrationStore((s) => s.queue[0] ?? null)
  const left = useNarrationStore((s) => s.queue.length)
  const screen = useGameStore((s) => s.screen)

  useEffect(() => {
    if (line === null) return
    const t = window.setTimeout(() => useNarrationStore.getState().next(), lineSeconds(line) * 1000)
    return () => window.clearTimeout(t)
  }, [line, left])

  // A new run or leaving the game drops what was waiting.
  useEffect(() => {
    if (screen !== 'game') useNarrationStore.getState().clear()
  }, [screen])

  if (line === null || screen !== 'game') return null
  return (
    <div className="keeper-say" role="status" aria-live="polite">
      <button type="button" className="keeper-say__line" onClick={() => useNarrationStore.getState().next()}>
        <span className="keeper-say__who">The keeper</span>
        <span key={line} className="keeper-say__text">
          {line}
        </span>
        {left > 1 && <span className="keeper-say__more" aria-label={`${left - 1} more`}>…</span>}
      </button>
    </div>
  )
}
