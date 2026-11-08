// ScareProps: the meshes the stager animates (statues, crypt doors, candle clusters, the grave
// hand). Greybox primitives, visual only: no colliders, so a staged prop can never trap the player.
// Animation state lives in stagedProps; this file only reads it each frame.
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { SCARE_CANDLES, SCARE_DOORS, SCARE_STAGING, SCARE_STATUES } from '../../data/scares'
import { candleLit, doorAngle, yawToward } from '../../game/systems/scareStaging'
import { playerPositionRef } from '../world/playerPositionRef'
import { stagedProps, statueOf } from './stagedProps'

const STONE = '#6f7378'
const WOOD = '#2b2118'
const IRON = '#3a3d40'
const WAX = '#d8c9a3'
const FLAME = '#e8913a'
const HAND = '#8c917c'

function Statue({ index }: { index: number }) {
  const anchor = SCARE_STATUES[index]
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
    <group ref={group} position={anchor.position as [number, number, number]} rotation={[0, anchor.awayYaw, 0]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.8, 0.5, 0.8]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.2, 0.32, 1.3, 8]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
      {/* The nose marks the front (+Z), so the turn reads even in the dark. */}
      <mesh position={[0, 1.95, 0.22]}>
        <boxGeometry args={[0.07, 0.12, 0.1]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
    </group>
  )
}

function Door({ index }: { index: number }) {
  const anchor = SCARE_DOORS[index]
  const hinge = useRef<Group>(null)

  useFrame(() => {
    const d = stagedProps.doors.get(index)
    if (hinge.current && d) {
      hinge.current.rotation.y = anchor.shutYaw + doorAngle(d, stagedProps.doorCreakLead)
    }
  })

  return (
    <group ref={hinge} position={anchor.position as [number, number, number]} rotation={[0, anchor.shutYaw, 0]}>
      <mesh position={[0.5, 1.05, 0]}>
        <boxGeometry args={[1, 2.1, 0.08]} />
        <meshStandardMaterial color={WOOD} roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 1.4, 0.05]}>
        <boxGeometry args={[1, 0.08, 0.03]} />
        <meshStandardMaterial color={IRON} roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  )
}

function CandleCluster({ index }: { index: number }) {
  const cluster = SCARE_CANDLES[index]
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
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.24, 8]} />
            <meshStandardMaterial color={WAX} roughness={0.8} />
          </mesh>
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
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.35, 6]} />
        <meshStandardMaterial color={HAND} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.11, 0.1, 0.04]} />
        <meshStandardMaterial color={HAND} roughness={0.9} />
      </mesh>
      {[-0.04, -0.013, 0.013, 0.04].map((fx) => (
        <mesh key={fx} position={[fx, 0.47, 0]} rotation={[0, 0, -fx * 3]}>
          <cylinderGeometry args={[0.01, 0.014, 0.12, 5]} />
          <meshStandardMaterial color={HAND} roughness={0.9} />
        </mesh>
      ))}
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
    </>
  )
}
