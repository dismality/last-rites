import { ITEM_MAP } from '../../data/items'
import { useInventoryStore } from '../../game/state'
import { hotbarItem } from '../../game/systems/satchel'
import { ItemIcon } from './ItemIcon'
import './satchel.css'

/**
 * Four-slot quick bar; the equipped slot is marked with a thick border and a "held" label.
 * The item name is not printed here: it is the aria-label, and the shared item-name label
 * shows it for 2 s when the slot changes.
 */
export function Hotbar() {
  const inventory = useInventoryStore((s) => s.inventory)
  const equipped = useInventoryStore((s) => s.equippedSlot)

  return (
    <ol className="hotbar" aria-label="Hotbar">
      {[0, 1, 2, 3].map((i) => {
        const id = hotbarItem(inventory, i)
        const def = id ? ITEM_MAP[id] : null
        const held = equipped === i && def !== null
        return (
          <li
            key={i}
            className={`hotbar__slot${held ? ' hotbar__slot--held' : ''}`}
            aria-current={held ? 'true' : undefined}
            aria-label={def ? `Slot ${i + 1}: ${def.name}${held ? ', held' : ''}` : `Slot ${i + 1}: empty`}
          >
            <span className="hotbar__key">{i + 1}</span>
            {id && <ItemIcon id={id} />}
            <span className="hotbar__held" aria-hidden="true">
              {held ? 'held' : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
