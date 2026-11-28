import { beforeEach, describe, expect, it } from 'vitest'
import { BOSS } from '../../data/boss'
import { RITE_SURGE } from '../../data/cemeteryLayout'
import { useEnemyStore } from './enemyStore'
import { RITE_ORDER } from '../../data/relics'
import { initialBoss } from '../systems/bossDirector'
import { useBossStore } from './bossStore'
import { useEndingStore } from './endingStore'
import { useInventoryStore } from './inventoryStore'
import { resetRun } from './resetRun'
import { holdsRelic, riteOpen, useRiteStore } from './riteStore'
import { useStageStore } from './stageStore'
import { useWorldStore } from './worldStore'

function giveAll(): void {
  for (const r of RITE_ORDER) useInventoryStore.getState().addRelic(r)
}

function toStage3Night(): void {
  useWorldStore.setState({ nightNumber: 3, phase: 'night' })
  useStageStore.getState().startStage(3)
}

beforeEach(() => {
  resetRun()
  useRiteStore.getState().reset()
  useBossStore.getState().reset()
})

describe('riteStore', () => {
  it('is closed by day and before the last stage', () => {
    giveAll()
    useWorldStore.setState({ nightNumber: 3, phase: 'day' })
    expect(riteOpen()).toBe(false)
    expect(useRiteStore.getState().place(0, RITE_ORDER[0]).kind).toBe('unavailable')
    useWorldStore.setState({ nightNumber: 2, phase: 'night' })
    expect(useRiteStore.getState().place(0, RITE_ORDER[0]).kind).toBe('unavailable')
  })

  it('refuses a relic the player does not hold', () => {
    toStage3Night()
    expect(holdsRelic(RITE_ORDER[0])).toBe(false)
    expect(useRiteStore.getState().place(0, RITE_ORDER[0]).kind).toBe('not-held')
  })

  it('the first right relic starts the rising clock and a second try at the same place is refused', () => {
    toStage3Night()
    giveAll()
    expect(useEndingStore.getState().riteStarted).toBe(false)
    const out = useRiteStore.getState().place(0, RITE_ORDER[0])
    expect(out).toMatchObject({ kind: 'placed', startsRisingClock: true, complete: false })
    expect(useEndingStore.getState().riteStarted).toBe(true)
    expect(useRiteStore.getState().place(0, RITE_ORDER[1]).kind).toBe('refused')
    expect(useRiteStore.getState().place(1, RITE_ORDER[1])).toMatchObject({ kind: 'placed', startsRisingClock: false })
  })

  it('a wrong relic stays in the satchel, locks the altar and does not start the clock (Req 17.3)', () => {
    toStage3Night()
    giveAll()
    const out = useRiteStore.getState().place(0, RITE_ORDER[1])
    expect(out.kind).toBe('wrong')
    expect(useRiteStore.getState().rite.placed).toEqual({})
    expect(useEndingStore.getState().riteStarted).toBe(false)
    expect(useInventoryStore.getState().inventory.relics).toContain(RITE_ORDER[1])
    // The 30 s lock applies to a right relic too, until it runs out.
    expect(useRiteStore.getState().place(0, RITE_ORDER[0])).toMatchObject({ kind: 'locked', secondsLeft: 30 })
    useStageStore.setState({ nightElapsed: 31 })
    expect(useRiteStore.getState().place(0, RITE_ORDER[0]).kind).toBe('placed')
  })

  it('with Father Crane out of play, the first relic wakes a surge of the ordinary dead', () => {
    toStage3Night()
    giveAll()
    useEnemyStore.getState().setEnemies([])
    useRiteStore.getState().place(0, RITE_ORDER[0])
    const risen = useEnemyStore.getState().enemies
    expect(risen.length).toBe(RITE_SURGE.length)
    expect(risen.some((e) => e.type === 'father-crane')).toBe(false)
  })

  it('with Father Crane out of play, the five relics alone end the case in Rest', () => {
    toStage3Night()
    giveAll()
    RITE_ORDER.forEach((r, slot) => useRiteStore.getState().place(slot, r))
    // The ending clears the night (the boss with it), so the ending itself is the proof.
    expect(useEndingStore.getState().ending).toBe('rest')
  })

  it('holds five placed relics while Crane lives, then ends in Rest once he has fallen (Req 17.4, 17.5)', () => {
    ;(BOSS as { inPlay: boolean }).inPlay = true
    toStage3Night()
    giveAll()
    RITE_ORDER.forEach((r, slot) => useRiteStore.getState().place(slot, r))
    expect(Object.keys(useRiteStore.getState().rite.placed)).toHaveLength(5)
    expect(useRiteStore.getState().tryComplete()).toBe(false)
    expect(useEndingStore.getState().ending).toBeNull()

    useBossStore.getState().setBoss({ ...initialBoss(), stage: 'risen' })
    expect(useRiteStore.getState().tryComplete()).toBe(false)

    useBossStore.getState().setBoss({ ...initialBoss(), stage: 'dead' })
    expect(useRiteStore.getState().tryComplete()).toBe(true)
    expect(useEndingStore.getState().ending).toBe('rest')
    // The night's state, the altar included, is cleared with the ending.
    expect(useRiteStore.getState().rite.placed).toEqual({})
    ;(BOSS as { inPlay: boolean }).inPlay = false
  })

  it('does not finish with fewer than five relics placed, even with Crane fallen', () => {
    toStage3Night()
    for (const r of RITE_ORDER.slice(0, 4)) useInventoryStore.getState().addRelic(r)
    RITE_ORDER.slice(0, 4).forEach((r, slot) => useRiteStore.getState().place(slot, r))
    useBossStore.getState().setBoss({ ...initialBoss(), stage: 'dead' })
    expect(useRiteStore.getState().tryComplete()).toBe(false)
  })

  it('empties the altar when the night is cleared (Retry Night, death, a new run)', () => {
    toStage3Night()
    giveAll()
    useRiteStore.getState().place(0, RITE_ORDER[0])
    useEndingStore.getState().setRiteStarted(false)
    expect(useRiteStore.getState().rite.placed).toEqual({})
  })
})
