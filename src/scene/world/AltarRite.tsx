// AltarRite: the relics standing on the altar during the rite (spec 10 task 4.5, Req 17.1).
// Rendering only: it reads `riteStore` and draws one small piece per placed relic along the altar.
// Each relic is its own item model, on a faint ember disc so the placed ones read from the nave.
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import { RITE_ORDER } from '../../data/relics'
import { useRiteStore } from '../../game/state/riteStore'
import type { RelicId } from '../../game/types'
import { GroundItem } from './ItemModel'

/** Height of the altar top and the spacing of the five places (metres). */
const ALTAR_TOP_Y = 1.1
const SLOT_SPACING = 0.32

export function AltarRite() {
  const placed = useRiteStore((s) => s.rite.placed)
  const slots = Object.entries(placed)
  if (slots.length === 0) return null
  return (
    <group position={[CHAPEL_ALTAR[0], ALTAR_TOP_Y, CHAPEL_ALTAR[2]]}>
      {slots.map(([slot, relic]) => (
        <group key={slot} position={[(Number(slot) - (RITE_ORDER.length - 1) / 2) * SLOT_SPACING, 0, 0]}>
          <GroundItem item={relic as RelicId} />
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 20]} />
            <meshBasicMaterial color="#e8913a" transparent opacity={0.25} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
