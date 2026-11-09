import { HEAVY_MAP } from '../../data/heavyMelee'
import { useCombatStore } from '../../game/state/combatStore'
import { useFeedbackStore } from '../../game/state/feedbackStore'
import { heavyStatsFor } from '../../game/systems/heavyAttack'
import type { HeavyMeleeId } from '../../game/types'
import './ChargeMeter.css'

const isHeavy = (id: string | null): id is HeavyMeleeId => id === 'wood-axe' || id === 'silver-sabre'

/** Heavy-attack charge bar under the crosshair, with a text percentage, plus the "Too tired" cue. */
export function ChargeMeter() {
  const held = useCombatStore((s) => s.live.heldId)
  const heldS = useCombatStore((s) => s.live.charge?.heldS ?? null)
  const upgrades = useCombatStore((s) => s.upgrades)
  const tooTired = useFeedbackStore((s) => s.tooTired)

  const chargeS = isHeavy(held) ? heavyStatsFor(held, upgrades).chargeS : HEAVY_MAP['wood-axe'].chargeS
  const frac = heldS === null ? 0 : Math.max(0, Math.min(1, heldS / chargeS))
  // Whole percent keeps the readout stable between ticks.
  const pct = Math.round(frac * 100)

  if (!tooTired && heldS === null) return null

  return (
    <div className="charge-meter" role="status">
      {heldS !== null && (
        <>
          <div
            className="charge-meter__bar"
            role="progressbar"
            aria-label="Heavy attack charge"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            data-full={frac >= 1}
          >
            <div className="charge-meter__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="charge-meter__text">{frac >= 1 ? 'Ready' : `Charging ${pct}%`}</span>
        </>
      )}
      {tooTired && (
        <span className="charge-meter__tired">
          <span aria-hidden="true">✕</span> Too tired
        </span>
      )}
    </div>
  )
}
