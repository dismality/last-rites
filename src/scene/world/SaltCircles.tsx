// Placed salt circles: a 2 m barrier zombies cannot cross for 30 s (Req 3.6).
// Mount AFTER EnemyDirector inside <GameLoop> so the barrier is applied to this
// frame's movement, not last frame's.
import { useFrame } from '@react-three/fiber'
import { WEAPON_MAP } from '../../data/weapons'
import { useEnemyStore, useGameStore, useProjectileStore } from '../../game/state'
import { constrainToSalt, tickSaltCircles } from '../../game/systems/projectiles'

const MAX_DT = 0.1
const RADIUS = WEAPON_MAP['salt-circle'].radius ?? 2
/** The circle flickers for its last seconds so expiry is never a surprise. */
const FADE_S = 4

export function SaltCircles() {
  const salts = useProjectileStore((s) => s.salts)

  useFrame((_s, rawDelta) => {
    const gs = useGameStore.getState()
    if (gs.paused || gs.examining || gs.journalOpen) return
    const ps = useProjectileStore.getState()
    if (ps.salts.length === 0) return
    ps.setSalts(tickSaltCircles(ps.salts, Math.min(rawDelta, MAX_DT)))

    const enemies = useEnemyStore.getState().enemies
    const held = constrainToSalt(enemies, useProjectileStore.getState().salts)
    if (held !== enemies) useEnemyStore.getState().setEnemies(held)
  })

  return (
    <>
      {salts.map((c) => {
        const fade = Math.min(1, c.remaining / FADE_S)
        return (
          <group key={c.id} position={[c.pos.x, 0.04, c.pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Two rings: the dashed inner one is a shape cue besides the pale colour. */}
            <mesh>
              <ringGeometry args={[RADIUS - 0.12, RADIUS, 48]} />
              <meshBasicMaterial color="#e9e4d8" transparent opacity={0.85 * fade} />
            </mesh>
            <mesh>
              <ringGeometry args={[RADIUS - 0.4, RADIUS - 0.34, 12, 1]} />
              <meshBasicMaterial color="#e9e4d8" transparent opacity={0.5 * fade} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
