import { useProgressionStore } from '../../game/state/progressionStore'
import { useScoreStore } from '../../game/state/scoreStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { simClock } from '../../game/state/simClock'
import { scorePanelView } from './scorePanelView'
import './ScorePanel.css'

/** Score, combo and Grave Coins. The pulse restarts by remounting a keyed span on change. */
export function ScorePanel() {
  const score = useProgressionStore((s) => s.score)
  const coins = useProgressionStore((s) => s.coins)
  const combo = useScoreStore((s) => s.combo)
  const lastKillAt = useScoreStore((s) => s.lastKillAt)
  const flashingLights = useSettingsStore((s) => s.flashingLights)

  const v = scorePanelView({ score, coins, combo, lastKillAt, now: simClock.now, flashingLights })

  return (
    <div className="score-panel" role="status" aria-label="Score">
      <span key={`s${score}`} className={`score-panel__score ${v.pulseClass}`}>
        {v.scoreText}
      </span>
      {v.comboVisible && (
        <div className="score-panel__combo">
          <span key={`c${combo}`} className={v.pulseClass}>
            {v.comboLabel}
          </span>
          <div className="score-panel__bar" aria-hidden="true">
            <div
              key={lastKillAt}
              className="score-panel__bar-fill"
              style={{ animationDuration: `${v.comboRemainingS}s` }}
            />
          </div>
        </div>
      )}
      <span key={`n${coins}`} className={`score-panel__coins ${v.pulseClass}`}>
        {v.coinsText}
      </span>
    </div>
  )
}
