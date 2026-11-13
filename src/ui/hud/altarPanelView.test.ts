import { describe, expect, it } from 'vitest'
import { ALTAR_LOCK_S, INITIAL_ALTAR_STATE } from '../../game/systems/altarAnswer'
import { altarStatus, clock, verdictMessage, DAY_MESSAGE, LINK_MESSAGE } from './altarPanelView'

describe('altarStatus', () => {
  it('by day the altar takes no answer and says why', () => {
    const s = altarStatus(INITIAL_ALTAR_STATE, 0, 'day', 0)
    expect(s.kind).toBe('day')
    expect(s.text).toBe(DAY_MESSAGE)
  })

  it('is ready at night with a fresh altar', () => {
    expect(altarStatus(INITIAL_ALTAR_STATE, 5, 'night', 0).kind).toBe('ready')
  })

  it('shows the lock countdown in m:ss', () => {
    const altar = { lockedUntil: 30, wrong: 1, linksAtLastWrong: 0 }
    const s = altarStatus(altar, 6, 'night', 0)
    expect(s).toMatchObject({ kind: 'locked', secondsLeft: 24, text: 'The altar is silent: 0:24' })
    expect(ALTAR_LOCK_S).toBe(30)
  })

  it('after 2 wrong answers it asks for one more link, and a new link clears it', () => {
    const altar = { lockedUntil: 0, wrong: 2, linksAtLastWrong: 1 }
    expect(altarStatus(altar, 100, 'night', 1)).toMatchObject({ kind: 'needs-link', text: LINK_MESSAGE })
    expect(altarStatus(altar, 100, 'night', 2).kind).toBe('ready')
  })
})

describe('verdictMessage', () => {
  it('has words for every verdict and none for a solved case', () => {
    expect(verdictMessage({ kind: 'solved' })).toBeNull()
    expect(verdictMessage({ kind: 'incomplete' })).toMatch(/Fill every blank/)
    expect(verdictMessage({ kind: 'locked', secondsLeft: 61 })).toBe('The altar is silent: 1:01')
    expect(verdictMessage({ kind: 'needs-link' })).toBe(LINK_MESSAGE)
    expect(verdictMessage({ kind: 'day' })).toBe(DAY_MESSAGE)
  })

  it('clock never goes negative', () => {
    expect(clock(-3)).toBe('0:00')
  })
})
