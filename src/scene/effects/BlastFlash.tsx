// One-shot expanding shell for flask and bomb bursts. Respects the flashing-lights setting:
// when off it is a soft, slow fade rather than a sharp pop.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSettingsStore } from '../../game/state'

const DURATION_S = 0.35
const DURATION_SOFT_S = 0.8

interface BlastFlashProps {
  position: [number, number, number]
  radius: number
  color: string
  onDone: () => void
}

export function BlastFlash({ position, radius, color, onDone }: BlastFlashProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const age = useRef(0)
  const soft = !useSettingsStore.getState().flashingLights
  const life = soft ? DURATION_SOFT_S : DURATION_S

  useFrame((_s, dt) => {
    const m = mesh.current
    if (!m) return
    age.current += Math.min(dt, 0.1)
    const k = Math.min(1, age.current / life)
    m.scale.setScalar(radius * (0.3 + 0.7 * k))
    ;(m.material as THREE.MeshBasicMaterial).opacity = (soft ? 0.25 : 0.6) * (1 - k)
    if (k >= 1) onDone()
  })

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  )
}
