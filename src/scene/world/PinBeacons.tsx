// Map pins in the world (spec 09 task 11l): a faint upright pencil line at each pin, and the
// moment a pin is reached. Emissive basic material only: no light, no flashing, and fog is
// ignored so the line stays visible through it. Mount inside <GameLoop>.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshBasicMaterial } from 'three'
import { useGameStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import { usePinStore } from '../../game/state/pinStore'
import { beaconFade, pinDistance, type PinSlot } from '../../game/systems/mapPins'

/** Tall enough to read over the headstones and oaks from across the grounds. */
const BEACON_HEIGHT_M = 14
const BEACON_RADIUS_M = 0.06
const BEACON_OPACITY = 0.4
/** Graphite-warm, like the pencil on the map. */
const BEACON_COLOR = '#e8c48a'

export function PinBeacons() {
  const pins = usePinStore((s) => s.pins)
  const show = useSettingsStore((s) => s.showPinsInWorld)
  const mats = useRef(new Map<PinSlot, MeshBasicMaterial>())
  const meshes = useRef(new Map<PinSlot, Mesh>())

  useFrame(() => {
    const gs = useGameStore.getState()
    if (gs.screen !== 'game' || isSimFrozen()) return
    const [x, , z] = usePlayerStore.getState().position
    if (!Number.isFinite(x) || !Number.isFinite(z)) return
    const player = { x, z }
    // Walking up to a pin clears it, whether or not its beacon is shown.
    usePinStore.getState().tickReach(player)
    for (const p of usePinStore.getState().pins) {
      const mat = mats.current.get(p.slot)
      if (mat) mat.opacity = BEACON_OPACITY * beaconFade(pinDistance(p, player))
    }
  })

  if (!show) return null
  return (
    <>
      {pins.map((p) => (
        <mesh
          key={p.slot}
          ref={(m) => {
            if (m) meshes.current.set(p.slot, m)
            else meshes.current.delete(p.slot)
          }}
          position={[p.x, BEACON_HEIGHT_M / 2, p.z]}
          renderOrder={5}
          raycast={() => null}
          name={`pin-beacon-${p.slot}`}
        >
          <cylinderGeometry args={[BEACON_RADIUS_M, BEACON_RADIUS_M, BEACON_HEIGHT_M, 6, 1, true]} />
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current.set(p.slot, m)
              else mats.current.delete(p.slot)
            }}
            color={BEACON_COLOR}
            transparent
            opacity={BEACON_OPACITY}
            fog={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}
