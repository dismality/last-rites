// AltarRite: the relics standing on the altar during the rite (spec 10 task 4.5, Req 17.1).
// Rendering only: it reads `riteStore` and draws one small piece per placed relic along the altar.
// PLACEHOLDER: each relic is a plain primitive with an ember glow until its own model exists (the
// relics are not in the world as models yet); the shapes differ so no relic reads by colour alone.
import { CHAPEL_ALTAR } from '../../data/cemeteryLayout'
import { RITE_ORDER } from '../../data/relics'
import { useRiteStore } from '../../game/state/riteStore'
import type { RelicId } from '../../game/types'

/** Height of the altar top and the spacing of the five places (metres). */
const ALTAR_TOP_Y = 1.1
const SLOT_SPACING = 0.32

function Piece({ relic }: { relic: RelicId }) {
  switch (relic) {
    case 'crane-rosary':
      return <torusGeometry args={[0.07, 0.015, 8, 16]} />
    case 'sextons-bell-clapper':
      return <coneGeometry args={[0.05, 0.16, 8]} />
    case 'childs-locket':
      return <sphereGeometry args={[0.05, 10, 8]} />
    case 'burial-shroud':
      return <boxGeometry args={[0.16, 0.02, 0.12]} />
    case 'reliquary-heart':
      return <octahedronGeometry args={[0.07]} />
  }
}

export function AltarRite() {
  const placed = useRiteStore((s) => s.rite.placed)
  const slots = Object.entries(placed)
  if (slots.length === 0) return null
  return (
    <group position={[CHAPEL_ALTAR[0], ALTAR_TOP_Y, CHAPEL_ALTAR[2]]}>
      {slots.map(([slot, relic]) => (
        <mesh
          key={slot}
          position={[(Number(slot) - (RITE_ORDER.length - 1) / 2) * SLOT_SPACING, 0.06, 0]}
        >
          <Piece relic={relic as RelicId} />
          <meshStandardMaterial color="#d8c9a3" emissive="#e8913a" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  )
}
