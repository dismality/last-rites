import { describe, expect, it } from 'vitest'
import { scorePanelView, type ScorePanelInput } from './scorePanelView'

const base: ScorePanelInput = {
  score: 1240,
  coins: 12,
  combo: 1,
  lastKillAt: null,
  now: 0,
  flashingLights: true,
}

describe('scorePanelView', () => {
  it('formats score and coins', () => {
    const v = scorePanelView(base)
    expect(v.scoreText).toBe('Score 1,240')
    expect(v.coinsText).toBe('◎ 12 coins')
  })

  it('hides the combo at x1.0 and shows it above', () => {
    expect(scorePanelView(base).comboVisible).toBe(false)
    const v = scorePanelView({ ...base, combo: 1.75, lastKillAt: 0, now: 2 })
    expect(v.comboVisible).toBe(true)
    expect(v.comboText).toBe('×1.75')
    expect(v.comboLabel).toBe('Combo ×1.75')
    expect(v.comboRemainingS).toBeCloseTo(2)
  })

  it('changes text without a pulse class when Flashing lights is off', () => {
    const a = scorePanelView({ ...base, flashingLights: false })
    const b = scorePanelView({ ...base, flashingLights: false, score: 1300 })
    expect(a.pulseClass).toBe('')
    expect(b.pulseClass).toBe('')
    expect(b.scoreText).toBe('Score 1,300')
    expect(scorePanelView(base).pulseClass).not.toBe('')
  })

  it('updates the coin count in the same render', () => {
    expect(scorePanelView({ ...base, coins: 13 }).coinsText).toBe('◎ 13 coins')
    expect(scorePanelView({ ...base, coins: 1 }).coinsText).toBe('◎ 1 coin')
  })
})
