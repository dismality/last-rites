import { itemIconUrl, MISSING_ICON_URL } from '../../data/assets'
import type { ItemId } from '../../game/types'
import './ItemIcon.css'

interface ItemIconProps {
  id: ItemId
  /** CSS pixels: 64 by default, 128 where there is clear room. */
  size?: 64 | 128
}

/**
 * The 64x64 pixel-art icon, drawn crisp. It is decorative: the item's name lives on the
 * parent control's aria-label, never in a title attribute (no browser tooltip).
 */
export function ItemIcon({ id, size = 64 }: ItemIconProps) {
  const url = itemIconUrl(id)
  const cls = `item-icon item-icon--${size}`
  if (url === MISSING_ICON_URL) {
    return (
      <span className={`${cls} item-icon--missing`} aria-hidden="true">
        ?
      </span>
    )
  }
  return <img className={cls} src={url} width={size} height={size} alt="" aria-hidden="true" draggable={false} />
}
