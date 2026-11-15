import { afterEach, describe, expect, it } from 'vitest'
import { installCaseSolvedWatcher } from './caseSolvedWatcher'
import { useChapelStore } from './chapelStore'
import { emit } from '../events'

describe('caseSolvedWatcher: daily chapel reset', () => {
  let off: (() => void) | null = null
  afterEach(() => off?.())

  it('clears the altar heal flag at dawn so the altar heals again each day', () => {
    off = installCaseSolvedWatcher()
    useChapelStore.getState().setAltarHealedToday(true)
    emit({ type: 'dawnStarted', nightNumber: 1 })
    expect(useChapelStore.getState().chapel.altarHealedToday).toBe(false)
  })
})
