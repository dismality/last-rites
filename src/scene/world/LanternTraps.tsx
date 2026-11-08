// Placed lantern traps: armed, then burning once a zombie closes in (Req 3.5).
// Ticks the pure trap logic and renders a small lantern that lights the area when sprung.
import { useFrame } from '@react-three/fiber'
import { playThrowSfx } from '../../audio/AudioManager'
import { TRAP_BURN_RADIUS_M, TRAP_LIGHT_INTENSITY } from '../../data/projectiles'
import { useEnemyStore, useGameStore, useLanternStore, useProjectileStore } from '../../game/state'
import { tickTrap } from '../../game/systems/projectiles'

const MAX_DT = 0.1

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
    if (enemies !== useEnemyStore.getState().enemies) useEnemyStore.getState().setEnemies(enemies)
    if (changed) ps.setTraps(next)
  })

  return (
    <>
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
              {/* No shadows: the 4-shadow-light budget belongs to the lantern and scenery. */}
              <pointLight
                position={[0, 0.6, 0]}
                color="#e8913a"
                intensity={TRAP_LIGHT_INTENSITY}
                distance={TRAP_BURN_RADIUS_M * 3}
              />
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
