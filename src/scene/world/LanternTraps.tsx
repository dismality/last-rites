// Placed lantern traps: armed, then burning once a zombie closes in (Req 3.5).
// Ticks the pure trap logic and renders a small lantern that lights the area when sprung.
import { useFrame } from '@react-three/fiber'
import { playThrowSfx } from '../../audio/AudioManager'
import { useRef } from 'react'
import type { PointLight } from 'three'
import { rampIntensity } from '../../game/systems/lightRamp'
import { TRAP_BURN_RADIUS_M, TRAP_LIGHT_INTENSITY, TRAP_LIGHT_POOL } from '../../data/projectiles'
import { useEnemyStore, useGameStore, useLanternStore, useProjectileStore } from '../../game/state'
import { tickTrap } from '../../game/systems/projectiles'
import { emit } from '../../game/events'
import { killReports } from '../../game/systems/killReports'

const MAX_DT = 0.1

const POOL_INDEXES = Array.from({ length: TRAP_LIGHT_POOL }, (_, i) => i)
const TRAP_LIGHT_RATE = 14

/**
 * Fixed pool of point lights, always mounted at intensity 0. Burning traps claim a slot and
 * move it; the light count never changes, so three.js never recompiles shaders mid-game.
 * No shadows: the 4-shadow-light budget belongs to the lantern and scenery.
 */
function TrapLightPool() {
  const refs = useRef<(PointLight | null)[]>([])
  useFrame((_s, delta) => {
    const burning = useProjectileStore.getState().traps.filter((t) => t.state === 'burning')
    const dt = Math.min(delta, MAX_DT)
    POOL_INDEXES.forEach((i) => {
      const light = refs.current[i]
      if (!light) return
      const trap = burning[i]
      if (trap) light.position.set(trap.pos.x, 0.6, trap.pos.z)
      light.intensity = rampIntensity(
        light.intensity,
        trap ? TRAP_LIGHT_INTENSITY : 0,
        dt,
        TRAP_LIGHT_RATE,
      )
    })
  })
  return (
    <>
      {POOL_INDEXES.map((i) => (
        <pointLight
          key={i}
          ref={(l) => {
            refs.current[i] = l
          }}
          color="#e8913a"
          intensity={0}
          distance={TRAP_BURN_RADIUS_M * 3}
          castShadow={false}
        />
      ))}
    </>
  )
}

export function LanternTraps() {
  const traps = useProjectileStore((s) => s.traps)

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen) return
    const ps = useProjectileStore.getState()
    if (ps.traps.length === 0) return
    const dt = Math.min(rawDelta, MAX_DT)
    const fuel = useLanternStore.getState().fuel

    let enemies = useEnemyStore.getState().enemies
    let changed = false
    const next = ps.traps
      .map((trap) => {
        const r = tickTrap(trap, dt, enemies, fuel)
        if (r.trap !== trap) changed = true
        if (r.sprung) playThrowSfx('trap-spring', trap.pos.x, 0.5, trap.pos.z)
        if (r.enemies.some((e, i) => e !== enemies[i])) enemies = r.enemies
        return r.trap
      })
      // Spent traps are removed so they stop costing a light.
      .filter((t) => t.state !== 'spent')
    if (next.length !== ps.traps.length) changed = true
    const original = useEnemyStore.getState().enemies
    if (enemies !== original) {
      useEnemyStore.getState().setEnemies(enemies)
      // Burn damage arrives a slice at a time; the tick that takes a zombie to 0 HP reports it.
      for (const ev of killReports(original, enemies, 'lantern-trap')) emit(ev)
    }
    if (changed) ps.setTraps(next)
  })

  return (
    <>
      <TrapLightPool />
      {traps.map((t) => (
        <group key={t.id} position={[t.pos.x, 0, t.pos.z]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.24, 8]} />
            <meshStandardMaterial
              color="#2a2522"
              emissive="#e8913a"
              emissiveIntensity={t.state === 'burning' ? 2 : 0.3}
            />
          </mesh>
          {t.state === 'burning' && (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                <ringGeometry args={[TRAP_BURN_RADIUS_M - 0.1, TRAP_BURN_RADIUS_M, 40]} />
                <meshBasicMaterial color="#e8913a" transparent opacity={0.5} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </>
  )
}
