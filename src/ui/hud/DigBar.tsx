import { useDigStore } from '../../game/state/digStore'
import { currentModifiers } from '../../game/state/derivedStats'
import { digElapsedS, liveDigDuration } from '../../game/systems/digDuration'

/** Hold-E progress while digging a grave. A text readout sits beside the bar, never colour alone. */
export function DigBar() {
  const active = useDigStore((s) => s.active)
  const progress = useDigStore((s) => s.progress)
  if (!active) return null
  const mult = currentModifiers().digTimeMult
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
        {digElapsedS(progress, mult).toFixed(1)} / {Number(liveDigDuration(mult).toFixed(1))} s
      </p>
    </div>
  )
}
