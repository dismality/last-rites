import { beforeEach, describe, expect, it, vi } from 'vitest'
import { upgradeCard } from '../../game/systems/dawnUpgrades'
import { announce, emptySilence, fired, majorScareActive } from '../../game/systems/scareSilence'
import { useProgressionStore } from '../../game/state/progressionStore'
import { dawnCardView, dawnPickerView, nextCardIndex, pickCard } from './dawnView'

beforeEach(() => useProgressionStore.getState().reset())

describe('dawnPickerView', () => {
  const offer = ['long-wick', 'steady-hands', 'marksman'] as const

  it('renders cards from upgradeCard', () => {
    const ranks = { 'long-wick': 1 }
    const v = dawnPickerView({ ranks, pendingPick: offer, majorScareActive: false })
    expect(v.open).toBe(true)
    expect(v.cards).toEqual(offer.map((id) => upgradeCard(ranks, id)))
  })

  it('stays closed with no offer', () => {
    expect(dawnPickerView({ ranks: {}, pendingPick: null, majorScareActive: false }).open).toBe(false)
  })

  it('waits for a major scare and opens after it', () => {
    let s = announce(emptySilence, 'door-slam', 10)
    const at = (now: number) =>
      dawnPickerView({ ranks: {}, pendingPick: offer, majorScareActive: majorScareActive(s, now) }).open
    expect(at(9)).toBe(false)
    s = fired(s, 'door-slam', 10)
    expect(at(11.9)).toBe(false)
    expect(at(12.1)).toBe(true)
  })

  it('a saved pending pick shows the same three cards', () => {
    useProgressionStore.getState().patch({ pendingPick: [...offer] })
    const { ranks, pendingPick } = useProgressionStore.getState()
    const v = dawnPickerView({ ranks, pendingPick, majorScareActive: false })
    expect(v.cards.map((c) => c.id)).toEqual([...offer])
  })
})

describe('pickCard', () => {
  it('calls the pick once', () => {
    const pick = vi.fn(() => true)
    pickCard('long-wick', pick)
    expect(pick).toHaveBeenCalledTimes(1)
    expect(pick).toHaveBeenCalledWith('long-wick')
  })
})

describe('nextCardIndex', () => {
  it('moves with arrows and wraps', () => {
    expect(nextCardIndex(2, 'ArrowRight', 3)).toBe(0)
    expect(nextCardIndex(0, 'ArrowLeft', 3)).toBe(2)
    expect(nextCardIndex(0, 'a', 3)).toBeNull()
  })
})

describe('dawnCardView', () => {
  it('lists the night score parts', () => {
    const v = dawnCardView({
      night: 1,
      zombiesBanished: 8,
      itemsFound: 3,
      recipeUnlocked: null,
      journalPageAvailable: true,
      killPoints: 80,
      clearBonus: 100,
      noDamageBonus: 0,
      nightScore: 180,
    })
    expect(v.rows[2]).toEqual({ label: 'New recipe', value: 'none' })
    expect(v.scoreParts[3]).toEqual({ label: 'Night score', value: '180' })
  })
})
