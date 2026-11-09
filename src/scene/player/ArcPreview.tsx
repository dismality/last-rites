// Dotted arc and landing ring shown while aiming a throwable (Req 3.1).
// Pure display: the points come from systems/projectiles.arcPoints.
import { Line } from '@react-three/drei'
import type { Vec3 } from '../../game/systems/projectiles'

interface ArcPreviewProps {
  points: readonly Vec3[]
  landing: Vec3 | null
  /** Blast radius, drawn as the landing ring so the player sees the area. */
  radius: number
}

export function ArcPreview({ points, landing, radius }: ArcPreviewProps) {
  if (points.length < 2) return null
  return (
    <group>
      {/* Dashes are length-based, not colour-based, so the cue survives any palette. */}
      <Line
        points={points.map((p): [number, number, number] => [p.x, p.y, p.z])}
        color="#cfe6d8"
        lineWidth={2}
        dashed
        dashSize={0.25}
        gapSize={0.2}
        transparent
        opacity={0.8}
        depthTest={false}
      />
      {landing && (
        <mesh
          position={[landing.x, 0.05, landing.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2}
        >
          <ringGeometry args={[Math.max(0.05, radius - 0.08), radius, 40]} />
          <meshBasicMaterial color="#cfe6d8" transparent opacity={0.6} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}
