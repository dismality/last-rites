// Red string between two pinned cards. A right link is a solid thick string with a round ✓ tag;
// a wrong one is a thin dashed string with a square ✗ tag, so the two never differ by colour alone.
import type { Pt, StringView } from './caseBoardView'

interface Props {
  strings: readonly StringView[]
  /** A string being dragged from a card to the pointer. */
  pending: { from: Pt; to: Pt } | null
}

export function RedString({ strings, pending }: Props) {
  return (
    <>
      <svg className="case-strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {strings.map((s) => (
          <path
            key={s.key}
            d={s.path}
            className={`case-string ${s.correct ? 'case-string--right' : 'case-string--wrong'}`}
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        ))}
        {pending && (
          <line
            x1={pending.from.x}
            y1={pending.from.y}
            x2={pending.to.x}
            y2={pending.to.y}
            className="case-string case-string--pending"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {strings.map((s) => (
        <span
          key={s.key}
          className={`case-tag ${s.correct ? 'case-tag--right' : 'case-tag--wrong'}`}
          style={{ left: `${s.mid.x}%`, top: `${s.mid.y}%` }}
          aria-hidden="true"
        >
          {s.correct ? '✓' : '✗'}
        </span>
      ))}
    </>
  )
}
