import { describe, expect, it } from 'vitest'
import { VENDING_ROWS } from '../../data/vending'
import { freshStock } from '../../game/systems/vending'
import { vendingPanelView } from './vendingPanelModel'

const NONE = { revolver: false, shotgun: false }
const BOTH = { revolver: true, shotgun: true }

describe('vendingPanelView', () => {
  it('shows name, price, "N left" and a blurb for every visible row', () => {
    const v = vendingPanelView(freshStock(), 30, BOTH)
    expect(v.rows).toHaveLength(VENDING_ROWS.length)
    expect(v.coinsText).toBe('Grave Coins: 30')
    const ammo = v.rows[0]
    expect(ammo).toMatchObject({ name: 'Revolver Cartridges ×6', priceText: '12 coins', leftText: '2 left', soldOut: false })
    for (const r of v.rows) expect(r.blurb.length).toBeGreaterThan(10)
  })

  it('hides the gun rows until the guns are owned', () => {
    expect(vendingPanelView(freshStock(), 0, NONE).rows.map((r) => r.id)).toEqual(['lamp-oil', 'kola-tonic', 'brisk-draught', 'bandage'])
  })

  it('marks a sold-out row in text and in its button label', () => {
    const stock = { stockLeft: { ...freshStock().stockLeft, bandage: 0 } }
    const row = vendingPanelView(stock, 0, NONE).rows.find((r) => r.id === 'bandage')!
    expect(row).toMatchObject({ soldOut: true, leftText: '0 left', buyLabel: 'Bandage: sold out' })
  })
})
