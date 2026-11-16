// Dawn merchant rules — pure TypeScript, no React / three.js / Howler.

import {
  FIXED_ROWS,
  MERCHANT_RANGE_M,
  MERCHANT_ROWS,
  MERCHANT_SPOT,
  MERCHANT_STAY_S,
  POOL_ROWS,
  type MerchantRowDef,
} from '../../data/merchant'
import type { Rng } from '../rng'
import type { Inventory, MerchantRowId, Phase, WorldState } from '../types'
import { addItem } from './inventory'

export interface StockRow {
  id: MerchantRowId
  qty: number
}
export interface Stock {
  rows: StockRow[]
}

export function merchantRow(id: MerchantRowId): MerchantRowDef {
  const row = MERCHANT_ROWS.find((r) => r.id === id)
  if (!row) throw new Error(`Unknown merchant row: ${id}`)
  return row
}

/** Fixed rows first, then POOL_ROWS distinct pool rows the player can use. */
export function dealStock(rng: Rng, owned: { revolver: boolean; shotgun: boolean }): Stock {
  const rows: StockRow[] = MERCHANT_ROWS.filter((r) => r.stock === 'fixed')
    .slice(0, FIXED_ROWS)
    .map((r) => ({ id: r.id, qty: r.dailyQty }))
  // Partial Fisher-Yates so the draw has no repeats.
  const pool = MERCHANT_ROWS.filter((r) => r.stock === 'pool' && (!r.needs || owned[r.needs]))
  for (let i = 0; i < POOL_ROWS && i < pool.length; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    rows.push({ id: pool[i].id, qty: pool[i].dailyQty })
  }
  return { rows }
}

/** He stays for the first MERCHANT_STAY_S of a day that dealt stock. */
export function merchantPresent(
  w: Pick<WorldState, 'phase' | 'phaseTime'>,
  stock: Stock | null,
): boolean {
  return stock !== null && w.phase === 'day' && w.phaseTime < MERCHANT_STAY_S
}

export function withinTradeRange(player: { x: number; z: number }): boolean {
  const [sx, , sz] = MERCHANT_SPOT.silas
  return Math.hypot(player.x - sx, player.z - sz) <= MERCHANT_RANGE_M
}

export type BuyResult =
  | { ok: true; stock: Stock; coins: number; inv: Inventory; spent: number; gained: number }
  | { ok: false; reason: 'sold-out' | 'coins' | 'space'; text: string }

/** Checks sold out, then coins, then space (addItem on a copy). Never mutates. */
export function tryBuy(
  stock: Stock,
  id: MerchantRowId,
  coins: number,
  inv: Inventory,
  slotLimit: number,
): BuyResult {
  const def = merchantRow(id)
  const row = stock.rows.find((r) => r.id === id)
  if (!row || row.qty <= 0) return { ok: false, reason: 'sold-out', text: 'Sold out' }
  if (coins < def.price) {
    return { ok: false, reason: 'coins', text: `Need ${def.price} coins, you have ${coins}` }
  }
  const added = addItem(inv, def.item, def.count, slotLimit)
  if (added.added < def.count) {
    return { ok: false, reason: 'space', text: 'No room in the satchel' }
  }
  return {
    ok: true,
    stock: { rows: stock.rows.map((r) => (r.id === id ? { ...r, qty: r.qty - 1 } : { ...r })) },
    coins: coins - def.price,
    inv: added.inv,
    spent: def.price,
    gained: def.count,
  }
}

export const canOpenMerchant = (c: {
  phase: Phase
  present: boolean
  majorActive: boolean
  inRange: boolean
}): boolean => c.phase === 'day' && c.present && c.inRange && !c.majorActive

/** The clue Silas hands over with the first purchase of a story run (spec 10, Req 14.5). */
export const VANE_RECEIPT_CLUE = 'vane-receipt'

/**
 * Whether this purchase hands over the Vane & Sons receipt: the run's first purchase, story only,
 * once. It is meant for Stage 1; a first purchase made later still gets it, so Case 3 can always
 * be solved (Req 7.5). `found` is every clue id found so far.
 */
export function receiptDue(c: {
  story: boolean
  stage: number
  found: readonly string[]
}): boolean {
  return c.story && c.stage >= 1 && !c.found.includes(VANE_RECEIPT_CLUE)
}

/** Caption and toast text for the hand-over. */
export const VANE_RECEIPT_TEXT = 'Silas slips you a Vane & Sons receipt. The hand is oddly familiar.'
