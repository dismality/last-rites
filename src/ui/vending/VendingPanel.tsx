// The hut vending machine's panel (spec 11 H6), in the merchant's style. It holds the cursor but
// never pauses the world, never protects the keeper and does not own Esc: MenuDialog gets no
// onEscape, so Esc reaches the pause menu (Req 6.7). Keyboard: Tab through the rows, Enter or
// Space buys, each control has a visible focus ring.
import { useEffect, useState } from 'react'
import { useCombatStore } from '../../game/state/combatStore'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useProgressionStore } from '../../game/state/progressionStore'
import { buyFromVending, closeVending, closeVendingIfOut, vendingOwnedGuns } from '../../game/state/vendingActions'
import { useVendingStore } from '../../game/state/vendingStore'
import { MenuDialog } from '../menus/MenuDialog'
import { ItemIcon } from '../satchel/ItemIcon'
import { vendingPanelView } from './vendingPanelModel'
import '../merchant/MerchantMenu.css'
import './VendingPanel.css'

const POLL_MS = 200

export function VendingPanel() {
  const open = useOverlayStore((s) => s.vendingOpen)
  const stock = useVendingStore((s) => s.stock)
  const coins = useProgressionStore((s) => s.coins)
  // Re-render when a gun is picked up or dropped, so its ammo row appears or goes.
  useInventoryStore((s) => s.inventory)
  useCombatStore((s) => s.firearms)
  const [refusal, setRefusal] = useState('')

  // The keeper can walk off with the panel open (the world keeps running): close it then.
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(closeVendingIfOut, POLL_MS)
    return () => window.clearInterval(id)
  }, [open])

  if (!open) {
    if (refusal) setRefusal('')
    return null
  }
  const view = vendingPanelView(stock, coins, vendingOwnedGuns())

  return (
    <MenuDialog titleId="vending-title">
      <h2 id="vending-title" className="menu__title">
        {view.title}
      </h2>
      <p className="menu__text vending__subtitle">{view.subtitle}</p>
      <p className="menu__text merchant__coins" data-testid="vending-coins">
        {view.coinsText}
      </p>
      <ul className="merchant__rows" aria-label="Machine rows">
        {view.rows.map((r) => (
          <li key={r.id} className={`merchant__row vending__row${r.soldOut ? ' vending__row--sold-out' : ''}`} data-row={r.id}>
            {/* The name is printed beside it, so the icon needs no focus stop or name label. */}
            <span className="merchant__ware" role="img" aria-label={r.name}>
              <ItemIcon id={r.item} />
            </span>
            <span className="vending__info">
              <span className="vending__name">{r.name}</span>
              <span className="vending__blurb">{r.blurb}</span>
            </span>
            <span className="vending__meta">
              <span className="merchant__price">{r.priceText}</span>
              {r.soldOut ? (
                <span className="vending__sold-out" role="status">
                  Sold out
                </span>
              ) : (
                <span className="merchant__left">{r.leftText}</span>
              )}
            </span>
            <button
              type="button"
              className="menu__button merchant__buy"
              aria-label={r.buyLabel}
              aria-disabled={r.soldOut}
              onClick={() => setRefusal(buyFromVending(r.id)?.text ?? '')}
            >
              Buy
            </button>
          </li>
        ))}
      </ul>
      <p role="alert" className="menu__text merchant__refusal" data-testid="vending-refusal">
        {refusal}
      </p>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={closeVending}>
          Close
        </button>
      </div>
    </MenuDialog>
  )
}
