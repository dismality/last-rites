import { usePlayerStore } from '../../game/state/playerStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { formatValue, isLowHealth, toFraction } from './hudMath'

// Flame occupies y from 4 (tip) to 56 (base) in a 40x60 viewBox.
const FLAME_TOP = 4
const FLAME_BASE = 56

/**
 * Health as a lantern flame: taller = healthier. Low health also swaps to a
 * jagged outline and shows a "!" mark so it is not conveyed by colour alone.
 */
export function LanternHealth() {
  const health = usePlayerStore((s) => s.health)
  const accessible = useSettingsStore((s) => s.accessibleHUD)
  const low = isLowHealth(health)
  const frac = toFraction(health)
  // Scale the flame vertically from its base so height is proportional to health/100.
  const scaleY = Math.max(0.08, frac)
  const fill = low ? 'var(--blood-bright)' : 'var(--ember)'
  const glow = low ? 'var(--blood)' : 'var(--ember-glow)'

  return (
    <div
      className="hud-gauge hud-health"
      role="meter"
      aria-label={`Health${low ? ' (low)' : ''}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(health)}
    >
      <svg viewBox="0 0 40 64" width="48" height="76" aria-hidden="true">
        {/* lantern frame */}
        <rect x="6" y="2" width="28" height="58" rx="4" fill="none" stroke="var(--parchment-dark)" strokeWidth="1.5" />
        <g
          style={{
            transform: `scaleY(${scaleY})`,
            transformOrigin: `20px ${FLAME_BASE}px`,
            transition: 'transform var(--transition-normal)',
          }}
        >
          <path
            d={`M20 ${FLAME_TOP} C30 20 34 32 30 44 C28 52 24 ${FLAME_BASE} 20 ${FLAME_BASE} C16 ${FLAME_BASE} 12 52 10 44 C6 32 12 22 20 ${FLAME_TOP} Z`}
            fill={fill}
            stroke={glow}
            strokeWidth="2"
            strokeDasharray={low ? '3 2' : undefined}
          />
          <path d="M20 30 C25 38 25 48 20 52 C15 48 15 38 20 30 Z" fill="var(--parchment)" opacity="0.8" />
        </g>
        {low && (
          <text x="20" y="20" textAnchor="middle" fontSize="14" fill="var(--parchment)" fontFamily="var(--font-num)">
            !
          </text>
        )}
      </svg>
      {accessible && <span className="hud-num">{formatValue(health)}</span>}
    </div>
  )
}
