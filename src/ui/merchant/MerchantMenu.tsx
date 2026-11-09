import { useEffect, useState } from 'react'
import { useOverlayStore } from '../../game/state/overlayStore'
import { closeMerchant } from '../../game/state/progressionActions'
import { useProgressionStore } from '../../game/state/progressionStore'
import { showItemName } from '../../game/state/itemNameStore'
import { MenuDialog } from '../menus/MenuDialog'
import { ItemIcon } from '../satchel/ItemIcon'
import { buyRow, closeMerchantIfOut, merchantMenuView } from './merchantMenuModel'
import './MerchantMenu.css'

const POLL_MS = 200

/** Modal trade menu. No onEscape: Esc reaches the pause trigger. Not mounted in the Hud yet (task 6.11). */
export function MerchantMenu() {
  const open = useOverlayStore((s) => s.merchantOpen)
  const stock = useProgressionStore((s) => s.stock)
  const coins = useProgressionStore((s) => s.coins)
  const [refusal, setRefusal] = useState('')

  // Distance, dusk and his leaving change outside React, so check a few times a second.
  useEffect(() => {
    if (!open) return
    closeMerchantIfOut()
    const id = window.setInterval(closeMerchantIfOut, POLL_MS)
    return () => window.clearInterval(id)
  }, [open])

  // Unmounting on close would drop the line too; this keeps a stale refusal from showing on reopen.
  if (!open) {
    if (refusal) setRefusal('')
    return null
  }
  const view = merchantMenuView(stock, coins)

  return (
    <MenuDialog titleId="merchant-title">
      <h2 id="merchant-title" className="menu__title">
        {view.title}
      </h2>
      <p className="menu__text merchant__coins">{view.coinsText}</p>
      <ul className="merchant__rows" aria-label="Wares">
        {view.rows.map((r) => (
          <li key={r.id} className="merchant__row">
            {/* Focusable so keyboard users get the name label too; the name is the aria-label. */}
            <span
              className="merchant__ware"
              role="img"
              tabIndex={0}
              aria-label={r.name}
              onMouseEnter={() => showItemName(r.item)}
              onFocus={() => showItemName(r.item)}
            >
              <ItemIcon id={r.item} />
              {r.count > 1 && <span className="merchant__count">×{r.count}</span>}
            </span>
            <span className="merchant__price">{r.price} coins</span>
            <span className="merchant__left">{r.leftText}</span>
            <button
              type="button"
              className="menu__button merchant__buy"
              aria-label={r.buyLabel}
              aria-disabled={r.soldOut}
              onClick={() => setRefusal(buyRow(r.id) ?? '')}
            >
              Buy
            </button>
          </li>
        ))}
      </ul>
      <p role="alert" className="menu__text merchant__refusal">
        {refusal}
      </p>
      <div className="menu__actions">
        <button type="button" className="menu__button" onClick={closeMerchant}>
          Close
        </button>
      </div>
    </MenuDialog>
  )
}
