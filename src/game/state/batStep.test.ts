import { beforeEach, describe, expect, it } from 'vitest'
import { BAT } from '../../data/bats'
import { captureBatSave, useBatStore } from './batStore'
import { PERCH_BOXES, stepBats } from './batStep'
import { resetRun } from './resetRun'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { sanitizeBatSave } from '../systems/batSave'
import { perchPosition } from '../systems/batPerches'

beforeEach(() => {
  resetRun()
  useWorldStore.setState({ phase: 'night', nightNumber: 1 })
  usePlayerStore.setState({ position: [1000, 0, 1000] })
})

describe('stepBats', () => {
  it('seeds 8 to 12 perched bats when night starts', () => {
    stepBats(1 / 60)
    const { entries } = useBatStore.getState()
    expect(entries.length).toBeGreaterThanOrEqual(Math.min(BAT.perchedMin, 1))
    expect(entries.length).toBeLessThanOrEqual(BAT.perchedMax)
    expect(entries.every((e) => e.bat.phase === 'perched')).toBe(true)
  })

  it('takes a bat off when the player walks up to it, and never touches health', () => {
    stepBats(1 / 60)
    const first = useBatStore.getState().entries[0].bat
    const at = perchPosition(PERCH_BOXES[first.boxIndex])
    usePlayerStore.setState({ position: [at[0] + 1, 0, at[2]] })
    stepBats(1 / 60)
    expect(useBatStore.getState().entries[0].bat.phase).toBe('fleeing')
  })

  it('clears the bats at dawn', () => {
    stepBats(1 / 60)
    useWorldStore.setState({ phase: 'dawn' })
    stepBats(1 / 60)
    expect(useBatStore.getState().entries).toEqual([])
    expect(useBatStore.getState().seededNight).toBeNull()
  })

  it('round-trips through the save block and is cleared by New Game', () => {
    stepBats(1 / 60)
    const saved = JSON.parse(JSON.stringify(captureBatSave()))
    const back = sanitizeBatSave(saved, PERCH_BOXES.length)
    expect(back.bats).toEqual(captureBatSave().bats)
    useBatStore.getState().restore(back)
    expect(useBatStore.getState().entries.length).toBe(back.bats.length)
    resetRun()
    expect(useBatStore.getState().entries).toEqual([])
    expect(useBatStore.getState().seededNight).toBeNull()
  })
})
