import { useDigStore } from '../../game/state/digStore'
import { DIG_DURATION_S } from '../../data/digging'

/** Hold-E progress while digging a grave. A text readout sits beside the bar, never colour alone. */
export function DigBar() {
  const active = useDigStore((s) => s.active)
  const progress = useDigStore((s) => s.progress)
  if (!active) return null
  const pct = Math.round(progress * 100)
  return (
    <div className="hud-dig">
      <p className="hud-dig__label">Digging… hold E</p>
      <div
        className="hud-dig__bar"
        role="progressbar"
        aria-label="Digging progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="hud-dig__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="hud-dig__time">
        {(progress * DIG_DURATION_S).toFixed(1)} / {DIG_DURATION_S} s
      </p>
    </div>
  )
}
