import { useDoorStore } from '../../game/state/doorStore'
import { doorLine } from '../../game/systems/barricade'
import type { DoorId } from '../../game/types'
import './DoorStatus.css'

const ORDER: readonly DoorId[] = ['front', 'vestry']

/** "Front door 2/3 (60, 41)" per chapel door; nothing before repair stage 1 (Req 16.12). */
export function DoorStatus() {
  const built = useDoorStore((s) => s.built)
  const doors = useDoorStore((s) => s.doors)
  if (!built) return null
  return (
    <ul className="door-status" aria-label="Chapel doors">
      {ORDER.map((id) => (
        <li key={id} className="door-status__line">
          <span className="door-status__rune" aria-hidden="true">
            ᚾ
          </span>
          {doorLine(id, doors[id])}
        </li>
      ))}
    </ul>
  )
}
