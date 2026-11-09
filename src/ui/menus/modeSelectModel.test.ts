import { describe, expect, it, vi } from 'vitest'
import { MODES, MODE_IDS } from '../../data/modes'
import { beginMode, initialChoice, modeOptions, moveChoice } from './modeSelectModel'

describe('modeSelect', () => {
  it('checks Normal by default', () => {
    expect(initialChoice()).toBe('normal')
  })

  it('offers four options in order', () => {
    expect(modeOptions().map((o) => o.id)).toEqual(['easy', 'normal', 'hard', 'endless'])
  })

  it('arrows move the choice and wrap', () => {
    expect(moveChoice('normal', 'ArrowDown')).toBe('hard')
    expect(moveChoice('normal', 'ArrowUp')).toBe('easy')
    expect(moveChoice('endless', 'ArrowRight')).toBe('easy')
    expect(moveChoice('easy', 'ArrowLeft')).toBe('endless')
    expect(moveChoice('easy', 'a')).toBe('easy')
  })

  it('Begin passes the chosen mode', () => {
    const onBegin = vi.fn()
    beginMode('hard', onBegin)
    expect(onBegin).toHaveBeenCalledWith('hard')
  })

  it('option text matches MODES', () => {
    for (const id of MODE_IDS) {
      const m = MODES[id]
      const o = modeOptions().find((x) => x.id === id)!
      expect(o.label).toBe(m.label)
      expect(o.lines).toContain(`Zombie HP ×${m.hpMult}`)
      expect(o.lines).toContain(`Zombie damage ×${m.damageMult}`)
      expect(o.lines).toContain(`Lantern drain ×${m.lanternDrainMult}`)
      expect(o.lines).toContain(`Elite chance ${Math.round(m.eliteChance * 100)}%`)
      expect(o.lines).toContain(`Score ×${m.scoreMult}`)
    }
    expect(modeOptions().find((o) => o.id === 'endless')!.lines).toContain(
      '120 s day, no relics or rite, no Retry Night',
    )
    expect(modeOptions().find((o) => o.id === 'easy')!.lines).toHaveLength(5)
  })
})
