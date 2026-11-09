import { ITEM_MAP } from '../../data/items'
import { showItemName } from '../../game/state/itemNameStore'
import type { ItemId } from '../../game/types'
import { ItemIcon } from './ItemIcon'

interface NamedItemIconProps {
  id: ItemId
  size?: 64 | 128
}

/**
 * Icon for list rows (ingredients, costs). The name is the aria-label (no title, so no browser
 * tooltip); hover or keyboard focus raises it on the shared item-name label.
 */
export function NamedItemIcon({ id, size = 64 }: NamedItemIconProps) {
  return (
    <span
      className="named-item-icon"
      role="img"
      tabIndex={0}
      aria-label={ITEM_MAP[id]?.name ?? id}
      onMouseEnter={() => showItemName(id)}
      onFocus={() => showItemName(id)}
    >
      <ItemIcon id={id} size={size} />
    </span>
  )
}
