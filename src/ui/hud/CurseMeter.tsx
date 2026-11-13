import './curseMeter.css'

/**
 * The Curse meter (design bible §11): a number and a bar, never colour alone. It falls as
 * correct clue links are made; the night ends when the case is solved. Static, so it needs no
 * motion or flashing handling.
 */
export function CurseMeter({ value, max }: { value: number; max: number }) {
  const safeMax = Math.max(1, max)
  const v = Math.min(safeMax, Math.max(0, value))
  return (
    <div
      className="hud-curse"
      role="meter"
      aria-label="Curse"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={v}
      aria-valuetext={`Curse ${v} of ${safeMax}`}
    >
      <span className="hud-curse__text">{`Curse ${v} / ${safeMax}`}</span>
      <span className="hud-curse__bar" aria-hidden="true">
        <span className="hud-curse__fill" style={{ width: `${(v / safeMax) * 100}%` }} />
      </span>
    </div>
  )
}
