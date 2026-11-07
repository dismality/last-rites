import { ITEM_MAP } from '../../data/items'
import { useInventoryStore } from '../../game/state'
import { hotbarItem } from '../../game/systems/satchel'
import { itemGlyph } from './itemGlyph'
import './satchel.css'

/** Four-slot quick bar; the equipped slot is marked with a border and a "held" label. */
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
          >
            <span className="hotbar__key">{i + 1}</span>
            {def && (
              <>
                <span aria-hidden="true">{itemGlyph(def.kind)}</span>
                <span className="hotbar__name">{def.name}</span>
                {held && <span className="hotbar__held">held</span>}
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
