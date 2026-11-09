import { useLanternStore } from '../../game/state/lanternStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { flameBrightness, flameSize, gutterActive, oilLabel } from '../../game/systems/lanternGauge'
import { LANTERN_FLICKER_BELOW } from '../../data/balance'
import './LanternGauge.css'

const FLAME_BASE = 56

/**
 * Lantern fuel as a flame: height and brightness follow fuel only, never health.
 * The gutter is a CSS animation applied only when it can vary (low oil, flashing lights on),
 * so no per-frame JS is needed.
 */
export function LanternGauge() {
  const fuel = useLanternStore((s) => s.fuel)
  const flashing = useSettingsStore((s) => s.flashingLights)
  const label = oilLabel(fuel)
  // Probing gutterFactor at one fixed time missed the flame: that instant can sit on the
  // wave's trough where the factor is 1, so the rule is asked directly.
  const gutters = gutterActive(fuel, flashing)
  const low = !Number.isFinite(fuel) || fuel < LANTERN_FLICKER_BELOW

  return (
    <div
      className="lantern-gauge"
      role="meter"
      aria-label="Lantern oil"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fuel)}
      aria-valuetext={label}
    >
      <svg viewBox="0 0 40 64" width="32" height="50" aria-hidden="true">
        <rect
          x="6"
          y="2"
          width="28"
          height="58"
          rx="4"
          fill="none"
          stroke="var(--parchment-dark)"
          strokeWidth="1.5"
        />
        <g
          className={
            gutters ? 'lantern-gauge__flame lantern-gauge__flame--gutter' : 'lantern-gauge__flame'
          }
          style={{
            transform: `scaleY(${flameSize(fuel)})`,
            transformOrigin: `20px ${FLAME_BASE}px`,
            opacity: flameBrightness(fuel),
          }}
        >
          <path
            d={`M20 4 C30 20 34 32 30 44 C28 52 24 ${FLAME_BASE} 20 ${FLAME_BASE} C16 ${FLAME_BASE} 12 52 10 44 C6 32 12 22 20 4 Z`}
            fill="var(--ember)"
            stroke="var(--ember-glow)"
            strokeWidth="2"
          />
          <path
            d="M20 30 C25 38 25 48 20 52 C15 48 15 38 20 30 Z"
            fill="var(--parchment)"
            opacity="0.8"
          />
        </g>
      </svg>
      <span
        className={low ? 'lantern-gauge__label lantern-gauge__label--low' : 'lantern-gauge__label'}
      >
        {label}
      </span>
    </div>
  )
}
