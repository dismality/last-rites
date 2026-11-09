import { describe, expect, it } from 'vitest'
import { createRunStats } from '../../game/systems/runStats'
import { statsPanelModel, takenModel } from './statsPanelModel'

describe('statsPanelModel', () => {
  it('shows 0, 0:00 and 0% for an empty run', () => {
    const m = statsPanelModel(createRunStats(), 0, 0, 'normal', 0)
    const get = (l: string) => m.rows.find((r) => r.label === l)?.value
    expect(get('Score')).toBe('0')
    expect(get('Time survived')).toBe('0:00')
    expect(get('Accuracy')).toBe('0%')
    expect(get('Endless best')).toBeUndefined()
  })

  it('formats time as m:ss and accuracy as N%', () => {
    const s = { ...createRunStats(), timeS: 125, shotsFired: 4, shotsHit: 3 }
    const m = statsPanelModel(s, 10, 2, 'hard', 0)
    expect(m.rows.find((r) => r.label === 'Time survived')?.value).toBe('2:05')
    expect(m.rows.find((r) => r.label === 'Accuracy')?.value).toBe('75%')
  })

  it('adds the Endless best only in Endless, and Close takes focus', () => {
    const m = statsPanelModel(createRunStats(), 5, 0, 'endless', 900)
    expect(m.rows.find((r) => r.label === 'Endless best')?.value).toBe('900')
    expect(m.closeAutofocus).toBe(true)
  })
})

describe('takenModel', () => {
  it('hides Retry and shows stats in Endless', () => {
    expect(takenModel('endless')).toEqual({ showRetry: false, showStats: true })
  })
  it('keeps Retry and shows no stats in story modes', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const) {
      expect(takenModel(mode)).toEqual({ showRetry: true, showStats: false })
    }
  })
})
