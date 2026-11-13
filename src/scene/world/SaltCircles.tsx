// Placed salt circles: a 2 m barrier zombies cannot cross for 30 s (Req 3.6).
// Mount AFTER EnemyDirector inside <GameLoop> so the barrier is applied to this
// frame's movement, not last frame's.
import { Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { ItemMesh } from './ItemModel'
import { WEAPON_MAP } from '../../data/weapons'
import { useEnemyStore, useProjectileStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import { constrainToSalt, tickSaltCircles } from '../../game/systems/projectiles'

const MAX_DT = 0.1
const RADIUS = WEAPON_MAP['salt-circle'].radius ?? 2
/** The circle flickers for its last seconds so expiry is never a surprise. */
const FADE_S = 4
/** The model is 1.05 x 0.1 x 0.96 m (docs/world-items.md); stretched to fill the 2 m radius. */
const SALT_MODEL_WIDTH_M = 1.051
const SALT_MODEL_HEIGHT_M = 0.1
const MODEL_XZ_SCALE = (RADIUS * 2) / SALT_MODEL_WIDTH_M
/** Wider is not taller: the stretched pile keeps a low ridge. */
const MODEL_HEIGHT_SCALE = 1.2

export function SaltCircles() {
  const salts = useProjectileStore((s) => s.salts)

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
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
        // The pile sinks flat over its last seconds, so expiry shows in shape as well as in the rings.
        const sy = Math.max(0.05, fade) * MODEL_HEIGHT_SCALE
        return (
          <group key={c.id} position={[c.pos.x, 0, c.pos.z]}>
            <Suspense fallback={null}>
              <group
                position={[0, (SALT_MODEL_HEIGHT_M * sy) / 2, 0]}
                scale={[MODEL_XZ_SCALE, sy, MODEL_XZ_SCALE]}
              >
                <ItemMesh item="salt-circle" />
              </group>
            </Suspense>
            <group position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
          </group>
        )
      })}
    </>
  )
}
