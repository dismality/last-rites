import { beforeEach, describe, expect, it } from 'vitest'
import { MERCHANT_SPOT } from '../../data/merchant'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { usePlayerStore } from '../../game/state/playerStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useWorldStore } from '../../game/state/worldStore'
import { buyRow, closeMerchantIfOut, merchantMenuView, merchantStateView } from './merchantMenuModel'

const [sx, , sz] = MERCHANT_SPOT.silas
const place = (dx: number): void => usePlayerStore.setState({ position: [sx + dx, 1.7, sz] })

beforeEach(() => {
  useWorldStore.setState({ phase: 'day', phaseTime: 10 })
  useProgressionStore.setState({
    stock: { rows: [{ id: 'bandage', qty: 1 }, { id: 'lamp-oil', qty: 0 }] },
    coins: 7,
  })
  useOverlayStore.setState({ merchantOpen: true })
  place(1)
})

describe('merchant menu model', () => {
  it('lists rows with price and "Left: n"', () => {
    const v = merchantMenuView(useProgressionStore.getState().stock, 7)
    expect(v.title).toBe('Silas Vane')
    expect(v.rows[0]).toMatchObject({ name: 'Bandage', price: 6, leftText: 'Left: 1', soldOut: false })
    expect(v.rows[1].soldOut).toBe(true)
  })

  it('a purchase updates the row and the coins', () => {
    expect(buyRow('bandage')).toBeNull()
    const v = merchantStateView()
    expect(v.rows[0].leftText).toBe('Left: 0')
    expect(v.coins).toBe(1)
  })

  it('a refusal names its reason and changes nothing', () => {
    const before = merchantStateView()
    const inv = useInventoryStore.getState().inventory
    expect(buyRow('lamp-oil')).toBe('Sold out')
    useProgressionStore.setState({ coins: 1 })
    expect(buyRow('bandage')).toMatch(/coins/)
    expect(merchantStateView().rows).toEqual(before.rows)
    expect(merchantStateView().coins).toBe(1)
    expect(useInventoryStore.getState().inventory).toBe(inv)
  })

  it('closes beyond 2.5 m and at dusk, stays open otherwise', () => {
    expect(closeMerchantIfOut()).toBe(false)
    expect(useOverlayStore.getState().merchantOpen).toBe(true)
    place(2.6)
    expect(closeMerchantIfOut()).toBe(true)
    expect(useOverlayStore.getState().merchantOpen).toBe(false)

    useOverlayStore.setState({ merchantOpen: true })
    place(1)
    useWorldStore.setState({ phase: 'dusk' })
    expect(closeMerchantIfOut()).toBe(true)
    expect(useOverlayStore.getState().merchantOpen).toBe(false)
  })
})
