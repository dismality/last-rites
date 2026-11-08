// Locked gates: the corridor gates (Mausoleum Row, Catacombs stair) and the ossuary door.
// Rendering and interaction only. Whether a key works, and the hint text, come from
// systems/gates.ts and data/gateHints.ts via the mystery store. Mount inside <Physics>.
//
// Opening removes the collider at once (so the player can walk through as soon as the
// unlock sequence starts) and then lifts the bars out of the way over GATE_LIFT_SECONDS.

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type * as THREE from 'three'
import {
  CATACOMBS,
  FENCE_PANEL_WIDTH,
  panelRun,
  type CorridorSpec,
} from '../../data/cemeteryLayout'
import { GATE_LIFT_SECONDS, OSSUARY_DOOR } from '../../data/gateHints'
import { useMysteryStore } from '../../game/state/mysteryStore'
import type { MysteryGateId } from '../../game/systems/mystery'
import { InstancedModel } from './InstancedModel'
import { Interactable } from './Interactable'
import { PART_MATERIALS } from './partMaterials'

/**
 * Raises a group once `open` flips true. Returns [ref to attach, whether the
 * group should still be mounted. A gate that is already open on mount (a loaded save)
 * never mounts its bars.
 */
function useLift(open: boolean, distance: number) {
  const ref = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const [gone, setGone] = useState(open)
  useFrame((_, dt) => {
    if (!open) {
      // Back to locked (new game): bars return.
      elapsed.current = 0
      if (gone) setGone(false)
      return
    }
    if (gone) return
    elapsed.current += dt
    const k = Math.min(1, elapsed.current / GATE_LIFT_SECONDS)
    // Ease-in: the bars shudder loose, then slide away.
    if (ref.current) ref.current.position.y = k * k * distance
    if (k >= 1) setGone(true)
  })
  return [ref, !open || !gone] as const
}

function useGateOpen(gate: MysteryGateId): boolean {
  return useMysteryStore((s) => s.mystery.gates[gate])
}

/** Fence bars across a corridor mouth. Interact tries the key, or shows a hint toward it. */
export function Gate({ spec }: { spec: CorridorSpec }) {
  const open = useGateOpen(spec.id)
  const { width, wallThickness: t, height } = spec
  const z = spec.entranceZ + spec.dir * (t / 2)
  const w = width + t * 2
  const bars = useMemo(() => panelRun('x', z, -w / 2, w / 2, FENCE_PANEL_WIDTH), [z, w])
  const [liftRef, barsMounted] = useLift(open, height)
  return (
    <>
      {!open && (
        <>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[w / 2, height / 2, t / 2]} position={[0, height / 2, z]} />
          </RigidBody>
          <group position={[0, 0, z]}>
            <Interactable
              id={`gate-${spec.id}`}
              action="open"
              size={[w, 1.4, t]}
              runeHeight={1.6}
              onInteract={() => useMysteryStore.getState().interactGate(spec.id, 'gate')}
            >
              {/* Invisible but raycastable: the bars themselves are instanced and thin. */}
              <mesh visible={false} position={[0, height / 2, 0]}>
                <boxGeometry args={[w, height, t]} />
              </mesh>
            </Interactable>
          </group>
        </>
      )}
      {barsMounted && (
        <group ref={liftRef}>
          <InstancedModel model="iron-fence" placements={bars} centerXZ />
        </group>
      )}
    </>
  )
}

/** Iron door across the catacomb corridor in front of the Reliquary Heart. */
export function OssuaryDoor() {
  const open = useGateOpen('ossuary')
  const { width, height } = CATACOMBS
  const { z, thickness } = OSSUARY_DOOR
  const [liftRef, barsMounted] = useLift(open, height)
  return (
    <>
      {!open && (
        <>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[width / 2, height / 2, thickness / 2]} position={[0, height / 2, z]} />
          </RigidBody>
          <group position={[0, 0, z]}>
            <Interactable
              id="gate-ossuary"
              action="open"
              size={[width, 1.4, thickness]}
              runeHeight={1.6}
              onInteract={() => useMysteryStore.getState().interactGate('ossuary', 'gate')}
            >
              <mesh visible={false} position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, thickness]} />
              </mesh>
            </Interactable>
          </group>
        </>
      )}
      {barsMounted && (
        <group ref={liftRef}>
          <mesh position={[0, height / 2, z]} material={PART_MATERIALS.slate} castShadow receiveShadow>
            <boxGeometry args={[width, height, thickness]} />
          </mesh>
          {/* Cross-bars so the door reads as ironwork rather than a wall. */}
          {[0.35, 0.95, 1.55].map((y) => (
            <mesh key={y} position={[0, y, z - thickness / 2 - 0.03]} material={PART_MATERIALS.trim}>
              <boxGeometry args={[width, 0.08, 0.06]} />
            </mesh>
          ))}
        </group>
      )}
    </>
  )
}
