import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../../game/state/settingsStore'
import { beginMode, initialChoice, modeOptions, moveChoice } from './modeSelectModel'

describe('modeSelect', () => {
  afterEach(() => useSettingsStore.getState().setSetting('developerMode', false))

  it('checks Normal by default', () => {
    expect(initialChoice()).toBe('normal')
  })

  it('offers Normal and Developer mode only', () => {
    expect(modeOptions().map((o) => o.id)).toEqual(['normal', 'developer'])
    expect(modeOptions().map((o) => o.label)).toEqual(['Normal', 'Developer mode'])
    for (const o of modeOptions()) expect(o.lines.length).toBeGreaterThan(0)
  })

  it('arrows move the choice and wrap', () => {
    expect(moveChoice('normal', 'ArrowDown')).toBe('developer')
    expect(moveChoice('developer', 'ArrowRight')).toBe('normal')
    expect(moveChoice('normal', 'ArrowUp')).toBe('developer')
    expect(moveChoice('normal', 'a')).toBe('normal')
  })

  it('both play Normal; Developer mode turns the developer tools on, Normal turns them off', () => {
    const onBegin = vi.fn()
    beginMode('developer', onBegin)
    expect(onBegin).toHaveBeenLastCalledWith('normal')
    expect(useSettingsStore.getState().developerMode).toBe(true)
    beginMode('normal', onBegin)
    expect(onBegin).toHaveBeenLastCalledWith('normal')
    expect(useSettingsStore.getState().developerMode).toBe(false)
  })
})
