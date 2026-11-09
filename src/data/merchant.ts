// The dawn merchant, Silas Vane — mirrored from docs/game-design.md §12.
// Pure data: no logic, no side effects.

import type { ItemId, MerchantRowId } from '../game/types'

export const MERCHANT_STAY_S = 90
/** Interact range for "E: Trade" (m). */
export const MERCHANT_RANGE_M = 2.5
export const FIXED_ROWS = 2
export const POOL_ROWS = 3

export interface MerchantRowDef {
  id: MerchantRowId
  item: ItemId
  /** Items handed over per purchase. */
  count: number
  price: number
  dailyQty: number
  stock: 'fixed' | 'pool'
  /** Pool row is only drawn once this weapon is owned. */
  needs?: 'revolver' | 'shotgun'
}

export const MERCHANT_ROWS: readonly MerchantRowDef[] = [
  { id: 'bandage', item: 'bandage', count: 1, price: 6, dailyQty: 3, stock: 'fixed' },
  { id: 'lamp-oil', item: 'lamp-oil', count: 1, price: 4, dailyQty: 3, stock: 'fixed' },
  { id: 'revolver-cartridges', item: 'revolver-cartridge', count: 6, price: 10, dailyQty: 2, stock: 'pool', needs: 'revolver' },
  { id: 'shotgun-shells', item: 'shotgun-shell', count: 4, price: 12, dailyQty: 2, stock: 'pool', needs: 'shotgun' },
  { id: 'holy-water', item: 'holy-water', count: 1, price: 8, dailyQty: 2, stock: 'pool' },
  { id: 'black-powder', item: 'black-powder', count: 1, price: 6, dailyQty: 3, stock: 'pool' },
  { id: 'lead-shot', item: 'lead-shot', count: 1, price: 5, dailyQty: 3, stock: 'pool' },
  { id: 'wood-planks', item: 'wood-plank', count: 1, price: 3, dailyQty: 5, stock: 'pool' },
  { id: 'kola-tonic', item: 'kola-tonic', count: 1, price: 15, dailyQty: 1, stock: 'pool' },
  { id: 'silver-filings', item: 'silver-filings', count: 1, price: 20, dailyQty: 1, stock: 'pool' },
]

/** Cart and Silas inside the south fence; yaw is chosen so he faces the hut. */
export const MERCHANT_SPOT = {
  cart: [-9, 0, 37],
  silas: [-7.2, 0, 36.2],
  yaw: Math.PI,
} as const
