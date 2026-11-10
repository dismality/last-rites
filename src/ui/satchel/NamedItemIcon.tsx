import { ITEM_MAP } from '../../data/items'
import { showItemName } from '../../game/state/itemNameStore'
import type { ItemId } from '../../game/types'
import { ItemIcon } from './ItemIcon'

interface NamedItemIconProps {
  id: ItemId
  size?: 64 | 128
  /**
   * Raise the shared centre label on hover and focus (default). Lists that print the name next
   * to the icon pass false, so no far-away label appears (spec 09, B9).
   */
  announce?: boolean
}

/**
 * Icon for list rows (ingredients, costs). The name is the aria-label (no title, so no browser
 * tooltip); hover or keyboard focus raises it on the shared item-name label.
 */
export function NamedItemIcon({ id, size = 64, announce = true }: NamedItemIconProps) {
  const show = announce ? () => showItemName(id) : undefined
  return (
    <span
      className="named-item-icon"
      role="img"
      // A printed name beside the icon already says it; no extra tab stop is needed then.
      tabIndex={announce ? 0 : -1}
      aria-label={ITEM_MAP[id]?.name ?? id}
      onMouseEnter={show}
      onFocus={show}
    >
      <ItemIcon id={id} size={size} />
    </span>
  )
}
