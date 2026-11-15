// ScareProps: the meshes the stager animates (statues, crypt doors, candle clusters, the grave
// hand), drawn from the Blender props (spec 09 task 11n-d). Only the statues have colliders (a
// fixed box each); doors, candles and the hand are visual only, so a staged prop never traps the
// player. Animation state lives in stagedProps; this file only reads it each frame.
import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { DRACO_PATH, propModelUrl } from '../../data/assets'
import { STATUE_BOXES } from '../../data/propScenery'
import '../assets/preloadModels'
import { SCARE_CANDLES, SCARE_DOORS, SCARE_STAGING, SCARE_STATUES } from '../../data/scares'
import { candleLit, doorAngle, yawToward } from '../../game/systems/scareStaging'
import { playerPositionRef } from '../world/playerPositionRef'
import { stagedProps, statueOf } from './stagedProps'

const FLAME = '#e8913a'

function Statue({ index }: { index: number }) {
  const anchor = SCARE_STATUES[index]
  const model = useGLTF(propModelUrl('statue-mourner'), DRACO_PATH).scene
  const group = useRef<Group>(null)
  const wasTurned = useRef(false)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const turned = statueOf(anchor.zoneId).status === 'turned'
    if (turned && !wasTurned.current) {
      // Snap in one frame, while the stager has verified the player is not looking.
      g.rotation.y = yawToward(
        { x: anchor.position[0], z: anchor.position[2] },
        { x: playerPositionRef.current.x, z: playerPositionRef.current.z },
      )
    } else if (!turned && wasTurned.current) {
      g.rotation.y = anchor.awayYaw
    }
    wasTurned.current = turned
  })

  return (
    <group
      ref={group}
      position={anchor.position as [number, number, number]}
      rotation={[0, anchor.awayYaw, 0]}
    >
      {/* statue-mourner.glb faces +Z, so the head turn reads even in the dark. */}
      <Clone object={model} />
    </group>
  )
}

/**
 * One static collider per statue (statue-mourner.json). The statue's yaw is a multiple of a quarter
 * turn when it is away, and the box is square, so it fits either way; the turned pose is a quick
 * snap of a 0.43 m half-width, which is not enough to trap the player.
 */
function StatueColliders() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {SCARE_STATUES.flatMap((s, i) =>
        STATUE_BOXES.map((b, j) => (
          <CuboidCollider
            key={`${i}-${j}`}
            args={[b.half[0], b.half[1], b.half[2]]}
            position={[s.position[0] + b.center[0], s.position[1] + b.center[1], s.position[2] + b.center[2]]}
          />
        )),
      )}
    </RigidBody>
  )
}

function Door({ index }: { index: number }) {
  const anchor = SCARE_DOORS[index]
  const model = useGLTF(propModelUrl('scare-door'), DRACO_PATH).scene
  const hinge = useRef<Group>(null)

  useFrame(() => {
    const d = stagedProps.doors.get(index)
    if (hinge.current && d) {
      hinge.current.rotation.y = anchor.shutYaw + doorAngle(d, stagedProps.doorCreakLead)
    }
  })

  return (
    <group
      ref={hinge}
      position={anchor.position as [number, number, number]}
      rotation={[0, anchor.shutYaw, 0]}
    >
      {/* scare-door.glb: hinge at the origin, leaf along +X. */}
      <Clone object={model} />
    </group>
  )
}

function CandleCluster({ index }: { index: number }) {
  const cluster = SCARE_CANDLES[index]
  const model = useGLTF(propModelUrl('candle-stub'), DRACO_PATH).scene
  const flames = useRef<(Mesh | null)[]>([])

  useFrame(() => {
    const state = stagedProps.candles.get(cluster.zoneId)
    const t = Date.now() * 0.006
    flames.current.forEach((flame, i) => {
      if (!flame) return
      const lit = state ? candleLit(state, i) : true
      flame.visible = lit
      flame.scale.y = 1 + 0.15 * Math.sin(t + i * 1.7)
    })
  })

  return (
    <>
      {cluster.positions.map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <Clone object={model} />
          <mesh
            ref={(m) => {
              flames.current[i] = m
            }}
            position={[0, 0.3, 0]}
          >
            <sphereGeometry args={[0.035, 8, 6]} />
            {/* toneMapped off so bloom picks the flame up; the warm colour is the cue, the dark is the tell. */}
            <meshBasicMaterial color={FLAME} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function GraveHand() {
  const model = useGLTF(propModelUrl('grave-hand'), DRACO_PATH).scene
  const group = useRef<Group>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { age, x, z } = stagedProps.hand
    const visible = age < SCARE_STAGING.handSlowS + 0.4
    g.visible = visible
    if (!visible) return
    const rise = Math.min(1, age / SCARE_STAGING.handRiseS)
    const sink = Math.max(0, (age - SCARE_STAGING.handSlowS) / 0.4)
    g.position.set(x, -0.45 + 0.5 * rise - 0.5 * sink, z)
  })

  return (
    <group ref={group} visible={false}>
      {/* grave-hand.glb: origin at ground level. */}
      <Clone object={model} />
    </group>
  )
}

export function ScareProps() {
  return (
    <>
      {SCARE_STATUES.map((s, i) => (
        <Statue key={s.zoneId} index={i} />
      ))}
      {SCARE_DOORS.map((_d, i) => (
        <Door key={i} index={i} />
      ))}
      {SCARE_CANDLES.map((c, i) => (
        <CandleCluster key={c.zoneId} index={i} />
      ))}
      <GraveHand />
      <StatueColliders />
    </>
  )
}
