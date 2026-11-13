// Thrown flasks and nail bombs as Rapier bodies. The flask bursts on first
// impact, the bomb on a 2 s fuse. Damage maths is in systems/projectiles.ts.
// Mount inside <GameLoop>. Requirements 3.2, 3.3, 3.4.
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { playThrowSfx } from '../../audio/AudioManager'
import { FLASK_MAX_FLIGHT_S, FLASK_STUN_S, NAIL_BOMB_FUSE_S } from '../../data/projectiles'
import { useEnemyStore, useGameStore, useLanternStore, useProjectileStore } from '../../game/state'
import { spawnDust } from '../../game/systems/melee'
import { emit } from '../../game/events'
import { killReports } from '../../game/systems/killReports'
import {
  createFuse,
  resolveFlask,
  resolveNailBomb,
  tickFuse,
  type Fuse,
} from '../../game/systems/projectiles'
import { currentModifiers } from '../../game/state/derivedStats'
import { flaskSplashRadius } from './flaskRadius'
import { meleeRuntime } from '../player/meleeRuntime'
import { BlastFlash } from '../effects/BlastFlash'
import type { ThrownItem } from '../../game/state/projectileStore'

const DUST_Y = 1.0
const BALL_RADIUS = 0.1

interface Flash {
  id: string
  x: number
  y: number
  z: number
  radius: number
  color: string
}

function Thrown({ item, onBurst }: { item: ThrownItem; onBurst: (flash: Flash) => void }) {
  const body = useRef<RapierRigidBody>(null)
  const done = useRef(false)
  const fuse = useRef<Fuse>(createFuse(NAIL_BOMB_FUSE_S))
  const age = useRef(0)

  const detonate = (): void => {
    const rb = body.current
    if (!rb || done.current) return
    done.current = true
    const t = rb.translation()
    const centre = { x: t.x, z: t.z }
    const enemies = useEnemyStore.getState().enemies
    const fuel = useLanternStore.getState().fuel
    const bonus = currentModifiers().flaskRadiusBonusM
    const result =
      item.kind === 'holy-water-flask'
        ? resolveFlask(centre, enemies, fuel, FLASK_STUN_S, bonus)
        : resolveNailBomb(centre, enemies, fuel)
    if (result.hitUids.length > 0) {
      useEnemyStore.getState().setEnemies(result.enemies)
      for (const ev of killReports(
        enemies,
        result.enemies,
        item.kind === 'holy-water-flask' ? 'holy-water-flask' : 'nail-bomb',
      )) {
        emit(ev)
      }
      for (const e of result.enemies) {
        if (result.hitUids.includes(e.uid)) {
          meleeRuntime.dustQueue.push(
            ...spawnDust({ x: e.pos.x, y: DUST_Y, z: e.pos.z }, Math.random),
          )
        }
      }
    }
    const flask = item.kind === 'holy-water-flask'
    playThrowSfx(flask ? 'flask-shatter' : 'bomb-blast', t.x, t.y, t.z)
    onBurst({
      id: item.id,
      x: t.x,
      y: Math.max(0.1, t.y),
      z: t.z,
      radius: flask ? flaskSplashRadius(bonus) : 3,
      color: flask ? '#cfe6d8' : '#e8913a',
    })
    useProjectileStore.getState().removeThrown(item.id)
  }

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen || gs.mapOpen) return
    const dt = Math.min(rawDelta, 0.1)
    age.current += dt
    if (item.kind === 'nail-bomb') {
      const r = tickFuse(fuse.current, dt)
      fuse.current = r.fuse
      if (r.fire) detonate()
    } else if (age.current >= FLASK_MAX_FLIGHT_S) {
      detonate()
    }
  })

  const flask = item.kind === 'holy-water-flask'
  return (
    <RigidBody
      ref={body}
      position={[item.origin.x, item.origin.y, item.origin.z]}
      linearVelocity={[item.velocity.x, item.velocity.y, item.velocity.z]}
      colliders={false}
      ccd
      onCollisionEnter={flask ? detonate : undefined}
    >
      <BallCollider args={[BALL_RADIUS]} restitution={flask ? 0 : 0.25} friction={1} />
      <mesh>
        <sphereGeometry args={[BALL_RADIUS, 12, 12]} />
        {/* Flask is pale and glassy; the bomb is dark iron with an ember glow. */}
        <meshStandardMaterial
          color={flask ? '#cfe6d8' : '#2a2522'}
          emissive={flask ? '#cfe6d8' : '#e8913a'}
          emissiveIntensity={flask ? 0.4 : 0.8}
        />
      </mesh>
    </RigidBody>
  )
}

export function ThrownItems() {
  const thrown = useProjectileStore((s) => s.thrown)
  const [flashes, setFlashes] = useState<readonly Flash[]>([])

  return (
    <>
      {thrown.map((t) => (
        <Thrown key={t.id} item={t} onBurst={(f) => setFlashes((fs) => [...fs, f])} />
      ))}
      {flashes.map((f) => (
        <BlastFlash
          key={f.id}
          position={[f.x, f.y, f.z]}
          radius={f.radius}
          color={f.color}
          onDone={() => setFlashes((fs) => fs.filter((x) => x.id !== f.id))}
        />
      ))}
    </>
  )
}
