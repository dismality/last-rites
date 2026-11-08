// Diggable grave mounds. Each is an Interactable "dig" target; the hold-E dig itself runs in
// digStore at the fixed step. A mound shows nothing on top: loot appears only after the dig.

import { useEffect } from 'react'
import { useDigStore, diggableGraves, DIG_ID_PREFIX } from '../../game/state/digStore'
import { useWorldStore } from '../../game/state/worldStore'
import { useToastStore } from '../../game/state/toastStore'
import { subscribeToType } from '../../game/events'
import { graveBurstRuntime } from '../effects/graveBurstRuntime'
import { Interactable } from './Interactable'

const GRAVES = diggableGraves()

/** Fresh earth heaped over a grave, or the dark open pit once it has been dug today. */
function Mound({ dug }: { dug: boolean }) {
  return dug ? (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.9, 1.7]} />
        <meshStandardMaterial color="#120e0b" roughness={1} />
      </mesh>
      {/* Spoil heaped beside the pit. */}
      <mesh position={[0.65, 0.1, 0]} scale={[0.35, 0.22, 0.8]}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color="#3b2f25" roughness={1} />
      </mesh>
    </group>
  ) : (
    <group>
      <mesh position={[0, 0.05, 0]} scale={[0.55, 0.22, 1.0]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#4a3a2c" roughness={1} />
      </mesh>
      {/* A leaning plank marks it as a grave, not just a hill. */}
      <mesh position={[0, 0.3, -1.05]} rotation={[0.15, 0, 0.08]}>
        <boxGeometry args={[0.28, 0.6, 0.04]} />
        <meshStandardMaterial color="#5b4a38" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function GraveMounds() {
  const day = useWorldStore((s) => s.nightNumber)
  const dugOnDay = useDigStore((s) => s.dig.dugOnDay)

  // Soil kicked up when a dig finishes.
  useEffect(
    () =>
      subscribeToType('digCompleted', (e) => {
        const g = GRAVES.find((p) => p.id === e.graveId)
        if (g) graveBurstRuntime.queue.push({ x: g.position[0], z: g.position[2] })
      }),
    [],
  )

  return (
    <>
      {GRAVES.map((g, i) => (
        <group key={g.id} position={[g.position[0], 0, g.position[2]]} rotation={[0, i * 0.4, 0]}>
          <Interactable
            id={`${DIG_ID_PREFIX}${g.id}`}
            action="dig"
            size={[1.1, 0.5, 2.1]}
            runeHeight={0.9}
            onInteract={() => {
              // Holding E digs (digStore); this rising edge only explains why it can't start.
              const why = useDigStore.getState().blockedReason(g.id)
              if (why) useToastStore.getState().push(why)
            }}
          >
            <Mound dug={dugOnDay[g.id] === day} />
          </Interactable>
        </group>
      ))}
    </>
  )
}
