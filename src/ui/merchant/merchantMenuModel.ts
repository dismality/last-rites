// View-model for the merchant menu. No DOM or React, so it runs in Node tests.
import { ITEM_MAP } from '../../data/items'
import { MERCHANT_ROWS } from '../../data/merchant'
import { buyFromMerchant, closeMerchant } from '../../game/state/progressionActions'
import { isMerchantPresent } from '../../game/state/merchantPresence'
import { usePlayerStore } from '../../game/state/playerStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { useWorldStore } from '../../game/state/worldStore'
import { withinTradeRange, type Stock } from '../../game/systems/merchant'
import type { MerchantRowId } from '../../game/types'

export interface MerchantRowView {
  id: MerchantRowId
  /** "Bandage" or "Revolver Cartridges ×6". */
  name: string
  price: number
  left: number
  leftText: string
  soldOut: boolean
  buyLabel: string
}

export interface MerchantMenuView {
  title: string
  coins: number
  coinsText: string
  rows: MerchantRowView[]
}

export function merchantMenuView(stock: Stock | null, coins: number): MerchantMenuView {
  const rows: MerchantRowView[] = (stock?.rows ?? []).map((s) => {
    const def = MERCHANT_ROWS.find((r) => r.id === s.id)!
    const base = ITEM_MAP[def.item]?.name ?? def.item
    const name = def.count > 1 ? `${base} ×${def.count}` : base
    return {
      id: s.id,
      name,
      price: def.price,
      left: s.qty,
      leftText: `Left: ${s.qty}`,
      soldOut: s.qty <= 0,
      buyLabel: `Buy ${name} for ${def.price} coins`,
    }
  })
  return { title: 'Silas Vane', coins, coinsText: `Grave Coins: ${coins}`, rows }
}

/** The menu stays open only by day, while he is here, and within reach. */
export function shouldCloseMerchant(c: { phase: string; present: boolean; inRange: boolean }): boolean {
  return c.phase !== 'day' || !c.present || !c.inRange
}

/** Closes the open menu if the trade is no longer possible. Returns whether it closed. */
export function closeMerchantIfOut(): boolean {
  const [x, , z] = usePlayerStore.getState().position
  const out = shouldCloseMerchant({
    phase: useWorldStore.getState().phase,
    present: isMerchantPresent(),
    inRange: withinTradeRange({ x, z }),
  })
  if (out) closeMerchant()
  return out
}

/** Buys one row. Returns the refusal line, or null on success. */
export function buyRow(id: MerchantRowId): string | null {
  const r = buyFromMerchant(id)
  return r.ok ? null : r.text
}

export const merchantStateView = (): MerchantMenuView => {
  const s = useProgressionStore.getState()
  return merchantMenuView(s.stock, s.coins)
}
