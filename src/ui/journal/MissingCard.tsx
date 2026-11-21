// A clue not found yet, pinned face down on the case board (playtest 11r). It says roughly where
// to look; clicking it drops a map pin there. It is not a link target (no `data-clue-id`).
import type { MissingCardView } from './caseBoardView'

interface Props {
  view: MissingCardView
  onPin: (view: MissingCardView) => void
}

export function MissingCard({ view, onPin }: Props) {
  const { at, tiltDeg, where, pin } = view
  const style = { left: `${at.x}%`, top: `${at.y}%`, ['--tilt' as string]: `${tiltDeg}deg` }
  return pin ? (
    <button type="button" className="clue-back" style={style} onClick={() => onPin(view)}>
      <span className="clue-card__pin" aria-hidden="true" />
      <span className="clue-back__title">Not found yet</span>
      <span className="clue-back__where">{where}</span>
      <span className="clue-back__act">Click to pin it on the map</span>
    </button>
  ) : (
    <div className="clue-back" style={style}>
      <span className="clue-card__pin" aria-hidden="true" />
      <span className="clue-back__title">Not found yet</span>
      <span className="clue-back__where">{where}</span>
    </div>
  )
}
