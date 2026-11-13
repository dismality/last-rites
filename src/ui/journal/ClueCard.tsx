// One pinned clue card. It is a real button: Enter or Space selects it, and picking a second
// card draws the string. Mouse drag is handled by the board, which reads `data-clue-id`.
import { clueIconUrl, type CardView } from './caseBoardView'

interface Props {
  view: CardView
  selected: boolean
  /** Strings already tied to this card, shown as text. */
  linkCount: number
  onPick: (id: string) => void
  onPointerDown: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void
}

export function ClueCard({ view, selected, linkCount, onPick, onPointerDown }: Props) {
  const { clue, at, tiltDeg } = view
  return (
    <button
      type="button"
      className={`clue-card ${selected ? 'clue-card--selected' : ''}`}
      data-clue-id={clue.id}
      aria-pressed={selected}
      style={{ left: `${at.x}%`, top: `${at.y}%`, ['--tilt' as string]: `${tiltDeg}deg` }}
      onClick={() => onPick(clue.id)}
      onPointerDown={(e) => onPointerDown(clue.id, e)}
    >
      <span className="clue-card__pin" aria-hidden="true" />
      <img className="clue-card__icon" src={clueIconUrl(clue.icon)} alt="" width={32} height={32} draggable={false} />
      <span className="clue-card__title">{clue.title}</span>
      <span className="clue-card__line">{clue.line}</span>
      {selected && <span className="clue-card__state">Selected: pick another card</span>}
      {linkCount > 0 && (
        <span className="clue-card__links">
          {linkCount} {linkCount === 1 ? 'string' : 'strings'}
        </span>
      )}
    </button>
  )
}
