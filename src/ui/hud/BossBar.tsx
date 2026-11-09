import { BOSS } from '../../data/boss'
import { useBossStore } from '../../game/state/bossStore'
import { useEnemyStore } from '../../game/state/enemyStore'
import './BossBar.css'

const NAME = 'Father Aldous Crane'

/** Boss health bar: wide, top centre, phase marks with text labels, HP as numbers (Req 17.3). */
export function BossBar() {
  const stage = useBossStore((s) => s.boss.stage)
  const crane = useEnemyStore((s) => s.enemies.find((z) => z.type === 'father-crane'))
  if (stage !== 'risen' || !crane) return null

  const hp = Math.max(0, Math.ceil(crane.hp))
  const max = Math.max(1, Math.round(crane.maxHp))
  const pct = Math.min(100, (hp / max) * 100)
  const marks = [
    { label: 'II', at: BOSS.phaseAt.two },
    { label: 'III', at: BOSS.phaseAt.three },
  ]

  return (
    <div className="boss-bar" role="group" aria-label={`${NAME}, ${hp} of ${max} health`}>
      <div className="boss-bar__name">{NAME}</div>
      <div className="boss-bar__frame">
        <div className="boss-bar__fill" style={{ width: `${pct}%` }} />
        {marks.map((m) => (
          <span key={m.label} className="boss-bar__mark" style={{ left: `${m.at * 100}%` }} aria-hidden="true" />
        ))}
      </div>
      <div className="boss-bar__labels" aria-hidden="true">
        {marks.map((m) => (
          <span key={m.label} className="boss-bar__label" style={{ left: `${m.at * 100}%` }}>
            {`Phase ${m.label} ${Math.round(m.at * 100)}%`}
          </span>
        ))}
      </div>
      <div className="boss-bar__hp">{`${hp} / ${max}`}</div>
    </div>
  )
}
