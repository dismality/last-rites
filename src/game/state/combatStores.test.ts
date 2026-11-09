import { describe, expect, it } from 'vitest'
import { DAMAGE_NUMBER } from '../../data/combatFeedback'
import { DOORS } from '../../data/barricades'
import { initialBoss } from '../systems/bossDirector'
import { useBossStore } from './bossStore'
import { useDoorStore } from './doorStore'
import { useEffectStore } from './effectStore'
import { useFeedbackStore } from './feedbackStore'

describe('doorStore', () => {
  it('build() fits 2 boards per door', () => {
    useDoorStore.getState().build()
    const s = useDoorStore.getState()
    expect(s.built).toBe(true)
    expect(s.doors.front).toEqual([DOORS.boardHp, DOORS.boardHp])
    expect(s.doors.vestry).toHaveLength(2)
  })

  it('resets to its initial state', () => {
    useDoorStore.getState().build()
    useDoorStore.getState().setNail({ door: 'front', elapsedS: 1 })
    useDoorStore.getState().reset()
    const s = useDoorStore.getState()
    expect(s.built).toBe(false)
    expect(s.doors).toEqual({ front: [], vestry: [] })
    expect(s.nail).toBeNull()
  })
})

describe('bossStore', () => {
  it('resets to the initial boss with riteClock 0', () => {
    useBossStore.getState().setBoss({ ...initialBoss(), riteClock: 12, phase: 2 })
    useBossStore.getState().reset()
    expect(useBossStore.getState().boss).toEqual(initialBoss())
    expect(useBossStore.getState().boss.riteClock).toBe(0)
  })
})

describe('effectStore', () => {
  it('clear() empties the list', () => {
    useEffectStore.getState().setEffects([{ id: 'adrenaline', leftS: 5 }])
    useEffectStore.getState().clear()
    expect(useEffectStore.getState().effects).toEqual([])
  })
})

describe('feedbackStore', () => {
  const num = (id: number) => ({ id, x: 0, y: 0, z: 0, value: 10, headshot: false, ageS: 0 })

  it('keeps at most 24 numbers, newest last', () => {
    const many = Array.from({ length: 40 }, (_, i) => num(i))
    useFeedbackStore.getState().setNumbers(many)
    const n = useFeedbackStore.getState().numbers
    expect(n).toHaveLength(DAMAGE_NUMBER.max)
    expect(n[n.length - 1].id).toBe(39)
  })

  it('clear() restores the initial state', () => {
    const f = useFeedbackStore.getState()
    f.setMarker({ ageS: 0, kind: 'hit', headshot: false })
    f.setNumbers([num(1)], 5)
    f.setTooTired(true)
    f.clear()
    const s = useFeedbackStore.getState()
    expect(s.marker).toBeNull()
    expect(s.numbers).toEqual([])
    expect(s.tooTired).toBe(false)
    expect(s.nextNumberId).toBe(1)
  })
})
