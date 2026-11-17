// Objective beacon: an amber pillar of light over the current objective's place, with a label
// naming it and saying how far it is ("Ledger · 24 m"). It follows the same point as the compass
// diamond and the minimap marker (guidanceStore.objective.position), fades out as the player
// arrives, and is hidden during the intro and with no placed objective. Emissive basic material
// only: no light, no flashing, and fog is ignored so it reads across the grounds.
// Mount inside <GameLoop>.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group, MeshBasicMaterial } from 'three'
import { useGameStore, usePlayerStore } from '../../game/state'
import { useGuidanceStore } from '../../game/state/guidanceStore'
import { useIntroStore } from '../../game/state/introStore'
import {
  flatDistance,
  objectiveBeaconFade,
  objectiveBeaconLabel,
  objectiveInHutFromOutside,
} from '../../game/systems/objectiveBeacon'

/** Tall enough to stand over the oaks and the chapel roof from across the grounds. */
const PILLAR_HEIGHT_M = 30
const CORE_RADIUS_M = 0.07
const HALO_RADIUS_M = 0.32
const CORE_OPACITY = 0.7
const HALO_OPACITY = 0.14
const AMBER = '#f0b45a'
/** The label sits a little over head height, above most props. */
const LABEL_HEIGHT_M = 2.6

export function ObjectiveBeacon() {
  const group = useRef<Group>(null)
  const core = useRef<MeshBasicMaterial>(null)
  const halo = useRef<MeshBasicMaterial>(null)
  const label = useRef<HTMLDivElement>(null)
  const text = useRef('')

  useFrame(() => {
    const g = group.current
    if (!g) return
    const objective = useGuidanceStore.getState().objective
    const at = objective?.position
    const shown = useGameStore.getState().screen === 'game' && !useIntroStore.getState().playing && at !== undefined
    g.visible = shown
    if (label.current) label.current.style.display = shown ? '' : 'none'
    if (!shown || !at) return
    g.position.set(at[0], at[1], at[2])
    const player = usePlayerStore.getState().position
    const d = flatDistance(player, at)
    const fade = objectiveBeaconFade(d)
    if (core.current) core.current.opacity = CORE_OPACITY * fade
    if (halo.current) halo.current.opacity = HALO_OPACITY * fade
    if (label.current) {
      label.current.style.opacity = String(fade)
      const next = objectiveBeaconLabel(objective?.marker, d, objectiveInHutFromOutside(player, at))
      if (next !== text.current) {
        text.current = next
        label.current.textContent = next
      }
    }
  })

  return (
    <group ref={group} visible={false} name="objective-beacon">
      <mesh position={[0, PILLAR_HEIGHT_M / 2, 0]} renderOrder={5} raycast={() => null}>
        <cylinderGeometry args={[CORE_RADIUS_M, CORE_RADIUS_M, PILLAR_HEIGHT_M, 8, 1, true]} />
        <meshBasicMaterial ref={core} color={AMBER} transparent opacity={CORE_OPACITY} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, PILLAR_HEIGHT_M / 2, 0]} renderOrder={5} raycast={() => null}>
        <cylinderGeometry args={[HALO_RADIUS_M, HALO_RADIUS_M, PILLAR_HEIGHT_M, 12, 1, true]} />
        <meshBasicMaterial ref={halo} color={AMBER} transparent opacity={HALO_OPACITY} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Html position={[0, LABEL_HEIGHT_M, 0]} center zIndexRange={[9, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div ref={label} className="objective-beacon-label" data-testid="objective-beacon-label" style={{ display: 'none' }} />
      </Html>
    </group>
  )
}
