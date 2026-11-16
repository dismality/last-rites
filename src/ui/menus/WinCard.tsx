// The ending card of a won run (spec 10 task 6.2): the Rest title and closing line, the walk-out
// line, and how far the run got (stages cleared, cases solved). Heads the run summary; the stats,
// credits and buttons follow it as for every ending.
import { useEffect, useRef } from 'react'
import { ENDING_MAP } from '../../data/endings'
import { useCaseStore } from '../../game/state/caseStore'
import { useStageStore } from '../../game/state/stageStore'
import { endingProgressRows } from '../../game/systems/endingStats'
import './menus.css'

export function WinCard({ titleId }: { titleId: string }) {
  const stage = useStageStore((s) => s.stage)
  const casesSolved = useCaseStore((s) => s.closed.length)
  const def = ENDING_MAP.rest
  const rows = endingProgressRows({ ending: 'rest', stage, casesSolved })
  const card = useRef<HTMLElement>(null)
  // The dialog focuses Close, far down the summary, which scrolls the card away; bring it back
  // once that focus has landed (focus stays on Close).
  useEffect(() => {
    const raf = requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <section ref={card} className="wincard" data-testid="win-card" aria-labelledby={titleId}>
      <p className="wincard__kicker">The curse is broken</p>
      <h2 id={titleId} className="menu__title menu__title--hero">
        {def.title}
      </h2>
      <p className="ending__closing">{def.closingLine}</p>
      <p className="wincard__walk">You walked out of the gates of Hollowmere at sunrise.</p>
      <dl className="ending__stats wincard__rows">
        {rows.map((r) => (
          <div key={r.label} className="ending__stat">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
