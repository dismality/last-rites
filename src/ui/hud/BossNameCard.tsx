import { useBossStore } from '../../game/state/bossStore'
import './BossNameCard.css'

/**
 * Three-second name card when Father Crane rises (Req 17.4). Pointer-events none and
 * no focus, so the player keeps control. Visibility follows the sim's nameCardLeftS.
 */
export function BossNameCard() {
  const show = useBossStore((s) => s.boss.stage === 'risen' && s.boss.nameCardLeftS > 0)
  if (!show) return null
  return (
    <div className="boss-name-card" role="status">
      <h2 className="boss-name-card__name">Father Aldous Crane</h2>
      <p className="boss-name-card__line">He sealed the doors</p>
    </div>
  )
}
