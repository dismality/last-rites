// View-model for the vending panel (spec 11 H6). No DOM or React, so it runs in Node tests.
import { VENDING_ROWS, type VendingRowId } from '../../data/vending'
import type { OwnedGuns } from '../../game/systems/elites'
import { visibleRows, type VendingState } from '../../game/systems/vending'
import type { ItemId } from '../../game/types'

export interface VendingRowView {
  id: VendingRowId
  item: ItemId
  /** Items per purchase. */
  qty: number
  /** "Revolver Cartridges ×6" or "Bandage". */
  name: string
  price: number
  priceText: string
  left: number
  /** "N left" (Req 6.2). */
  leftText: string
  soldOut: boolean
  blurb: string
  buyLabel: string
}

export interface VendingPanelView {
  title: string
  subtitle: string
  coins: number
  coinsText: string
  rows: VendingRowView[]
}

export function vendingPanelView(stock: VendingState, coins: number, owned: OwnedGuns): VendingPanelView {
  const rows = visibleRows(owned).map((r): VendingRowView => {
    const left = Math.max(0, stock.stockLeft[r.id] ?? 0)
    const name = r.qty > 1 ? `${r.name} ×${r.qty}` : r.name
    return {
      id: r.id,
      item: r.item,
      qty: r.qty,
      name,
      price: r.price,
      priceText: `${r.price} coins`,
      left,
      leftText: `${left} left`,
      soldOut: left <= 0,
      blurb: r.blurb,
      buyLabel: left <= 0 ? `${name}: sold out` : `Buy ${name} for ${r.price} coins, ${left} left`,
    }
  })
  return {
    title: 'Hollowmere Automatic Dispenser',
    subtitle: 'Coin in, pull the handle.',
    coins,
    coinsText: `Grave Coins: ${coins}`,
    rows,
  }
}

/** Every row in the data, for tests and the dev panel. */
export const VENDING_ROW_COUNT = VENDING_ROWS.length
