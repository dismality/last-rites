import { useLanternStore } from '../../game/state/lanternStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { formatValue, toFraction } from './hudMath'

const TUBE_TOP = 6
const TUBE_HEIGHT = 48

/** Lantern fuel as a glass tube of oil; fill height is proportional to fuel/100. */
export function FuelReservoir() {
  const fuel = useLanternStore((s) => s.fuel)
  const accessible = useSettingsStore((s) => s.accessibleHUD)
  const frac = toFraction(fuel)
  const fillH = TUBE_HEIGHT * frac

  return (
    <div
      className="hud-gauge hud-fuel"
      role="meter"
      aria-label="Lantern fuel"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fuel)}
    >
      <svg viewBox="0 0 20 60" width="20" height="76" aria-hidden="true">
        <rect
          x="4"
          y={TUBE_TOP + TUBE_HEIGHT - fillH}
          width="12"
          height={fillH}
          rx="2"
          fill="var(--ember)"
          style={{ transition: 'all var(--transition-normal)' }}
        />
        <rect x="4" y={TUBE_TOP} width="12" height={TUBE_HEIGHT} rx="3" fill="none" stroke="var(--parchment)" strokeWidth="1.5" />
        {/* tick marks at 25/50/75% so level reads without colour */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="4" x2="8" y1={TUBE_TOP + TUBE_HEIGHT * (1 - t)} y2={TUBE_TOP + TUBE_HEIGHT * (1 - t)} stroke="var(--parchment)" strokeWidth="1" />
        ))}
      </svg>
      {accessible && <span className="hud-num">{formatValue(fuel)}</span>}
    </div>
  )
}
