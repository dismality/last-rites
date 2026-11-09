import { beforeEach, describe, expect, it } from 'vitest'
import { DAWN_DURATION_S, DAWN_AFTER_PICK_S } from '../../data/balance'
import { merchantRow } from '../systems/merchant'
import { useInventoryStore } from './inventoryStore'
import { useOverlayStore } from './overlayStore'
import { usePlayerStore } from './playerStore'
import {
  buyFromMerchant,
  closeMerchant,
  openMerchant,
  pickUpgrade,
  startRun,
} from './progressionActions'
import { useProgressionStore } from './progressionStore'
import { useWorldStore } from './worldStore'

beforeEach(() => startRun('normal'))

const openDawn = (ids: Parameters<typeof pickUpgrade>[0][]) => {
  useWorldStore.getState().applyWorldState({ phase: 'dawn', phaseTime: 1 })
  useProgressionStore.getState().patch({ pendingPick: ids })
}

describe('startRun', () => {
  it('resets ranks and coins, deals two contracts and keeps the mode', () => {
    useProgressionStore.getState().patch({ ranks: { 'long-wick': 2 }, coins: 40, score: 99 })
    startRun('hard')
    const s = useProgressionStore.getState()
    expect(s.ranks).toEqual({})
    expect(s.coins).toBe(0)
    expect(s.score).toBe(0)
    expect(s.mode).toBe('hard')
    expect(s.contracts).toHaveLength(2)
    expect(usePlayerStore.getState().maxHealth).toBe(100)
  })
})

describe('pickUpgrade', () => {
  it('is ignored when nothing is pending', () => {
    expect(pickUpgrade('long-wick')).toBe(false)
    expect(useProgressionStore.getState().ranks).toEqual({})
  })

  it('a second pick for the same dawn changes nothing', () => {
    openDawn(['long-wick', 'steady-hands'])
    expect(pickUpgrade('long-wick')).toBe(true)
    expect(pickUpgrade('steady-hands')).toBe(false)
    expect(useProgressionStore.getState().ranks).toEqual({ 'long-wick': 1 })
  })

  it('jumps dawn to its last seconds', () => {
    openDawn(['long-wick'])
    pickUpgrade('long-wick')
    expect(useWorldStore.getState().phaseTime).toBeGreaterThanOrEqual(DAWN_DURATION_S - DAWN_AFTER_PICK_S)
  })

  it('Iron Constitution raises max HP and heals 15', () => {
    usePlayerStore.getState().setHealth(50)
    openDawn(['iron-constitution'])
    pickUpgrade('iron-constitution')
    expect(usePlayerStore.getState().maxHealth).toBe(115)
    expect(usePlayerStore.getState().health).toBe(65)
  })
})

describe('merchant', () => {
  it('a purchase updates coins, stock and satchel together', () => {
    useProgressionStore.getState().patch({
      coins: 10,
      stock: { rows: [{ id: 'bandage', qty: 3 }] },
    })
    const price = merchantRow('bandage').price
    const r = buyFromMerchant('bandage')
    expect(r.ok).toBe(true)
    const s = useProgressionStore.getState()
    expect(s.coins).toBe(10 - price)
    expect(s.stock?.rows[0].qty).toBe(2)
    expect(s.stats.coinsSpent).toBe(price)
    expect(useInventoryStore.getState().inventory.slots.some((x) => x.item === 'bandage')).toBe(true)
  })

  it('a failed purchase changes nothing', () => {
    useProgressionStore.getState().patch({ coins: 0, stock: { rows: [{ id: 'bandage', qty: 3 }] } })
    const r = buyFromMerchant('bandage')
    expect(r.ok).toBe(false)
    expect(useProgressionStore.getState().stock?.rows[0].qty).toBe(3)
  })

  it('opens and closes the overlay', () => {
    openMerchant()
    expect(useOverlayStore.getState().merchantOpen).toBe(true)
    closeMerchant()
    expect(useOverlayStore.getState().merchantOpen).toBe(false)
  })
})
