import { useGameStore } from '../../game/state/gameStore'
import { useWaveStore } from '../../game/state/waveStore'
import { tallyGroups } from './hudMath'

/**
 * Wave counter as a chalk-style tally: one stroke per wave cleared, fives struck through.
 * The text label carries the same information for screen readers and low-vision players.
 */
export function WaveTally() {
  const screen = useGameStore((s) => s.screen)
  const phase = useWaveStore((s) => s.waves.phase)
  const waveIndex = useWaveStore((s) => s.waves.waveIndex)
  const total = useWaveStore((s) => s.totalWaves)
  if (screen !== 'game' || total === 0 || phase === 'idle') return null

  // During a gap the index already points at the next wave, so everything before it is cleared.
  const cleared = phase === 'done' ? total : waveIndex
  const current = Math.min(total, phase === 'done' ? total : waveIndex + 1)
  const label =
    phase === 'done'
      ? `All ${total} waves cleared`
      : phase === 'gap'
        ? `Wave ${cleared} of ${total} cleared`
        : `Wave ${current} of ${total}`

  return (
    <div className="hud-tally" role="status" aria-label={label}>
      <svg className="hud-tally__marks" viewBox={`0 0 ${Math.max(1, tallyGroups(total)) * 34} 30`} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const g = Math.floor(i / 5)
          const k = i % 5
          const done = i < cleared
          const x = g * 34 + 4 + k * 6
          return k < 4 ? (
            <line
              key={i}
              x1={x}
              y1="4"
              x2={x + 0.6}
              y2="26"
              className={done ? 'hud-tally__mark hud-tally__mark--done' : 'hud-tally__mark'}
            />
          ) : (
            <line
              key={i}
              x1={g * 34 + 1}
              y1="22"
              x2={g * 34 + 31}
              y2="8"
              className={done ? 'hud-tally__mark hud-tally__mark--done' : 'hud-tally__mark'}
            />
          )
        })}
      </svg>
      <span className="hud-tally__label">{label}</span>
    </div>
  )
}
