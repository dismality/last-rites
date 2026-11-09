import { COMBO } from '../../data/scoring'
import { comboView, INITIAL_SCORE_STATE } from '../../game/systems/score'

export interface ScorePanelInput {
  score: number
  coins: number
  combo: number
  lastKillAt: number | null
  now: number
  flashingLights: boolean
}

export interface ScorePanelView {
  scoreText: string
  coinsText: string
  comboVisible: boolean
  comboText: string
  comboLabel: string
  /** Seconds the combo window has left; drives the bar's drain animation. */
  comboRemainingS: number
  /** Empty when Flashing lights is off, so values change in place with no motion. */
  pulseClass: string
}

const PULSE_CLASS = 'score-panel__pulse'

export function scorePanelView(i: ScorePanelInput): ScorePanelView {
  const c = comboView({ ...INITIAL_SCORE_STATE, combo: i.combo, lastKillAt: i.lastKillAt }, i.now)
  const coins = Math.max(0, Math.floor(i.coins))
  return {
    scoreText: `Score ${Math.max(0, Math.round(i.score)).toLocaleString('en-US')}`,
    coinsText: `◎ ${coins} ${coins === 1 ? 'coin' : 'coins'}`,
    comboVisible: c.visible,
    comboText: c.text,
    comboLabel: c.visible ? `Combo ${c.text}` : '',
    comboRemainingS: c.barFraction * COMBO.windowS,
    pulseClass: i.flashingLights ? PULSE_CLASS : '',
  }
}
