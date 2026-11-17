// A marked stand-in for art that has not landed yet (design bible §14, "Waiting list and
// placeholders"). Plain primitives only, never drawn art. In dev (`?dev=1` or a DEV build) it
// shows a small "PLACEHOLDER" label so playtests can see what is missing; production shows none.
// Every use site carries a `// PLACEHOLDER: <path>` comment and the path has a row in
// data/placeholders.ts (checked by tests/placeholderComments.test.ts).

import type { ReactNode } from 'react'
import { Html } from '@react-three/drei'
import { isDevEnabled } from '../../dev/devFlag'

const SHOW_LABEL = typeof window !== 'undefined' && isDevEnabled(window.location.search, import.meta.env.DEV)

export type PlaceholderShape = 'cabinet' | 'bottle' | 'box'

interface PlaceholderMeshProps {
  /** The missing file, shown in the dev label. */
  path: string
  shape: PlaceholderShape
  /** Object name, so a scene search finds it (e.g. "Brisk Draught (placeholder)"). */
  name: string
  color?: string
  /** Box size in metres (cabinet and box). */
  size?: readonly [number, number, number]
  /** Height of the dev label above the origin. */
  labelHeight?: number
  children?: ReactNode
}

export function PlaceholderMesh({ path, shape, name, color = '#5a5048', size = [0.3, 0.3, 0.3], labelHeight, children }: PlaceholderMeshProps) {
  const top = labelHeight ?? (shape === 'bottle' ? 0.25 : size[1] + 0.1)
  return (
    <group name={name} userData={{ placeholder: path }}>
      {shape === 'bottle' ? (
        <>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 10]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.012, 0.03, 0.06, 8]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, size[1] / 2, 0]}>
          <boxGeometry args={[size[0], size[1], size[2]]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      )}
      {children}
      {SHOW_LABEL && (
        <Html position={[0, top, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <span
            title={path}
            style={{ font: '10px monospace', color: '#fff', background: '#a0102a', padding: '1px 4px', whiteSpace: 'nowrap' }}
          >
            PLACEHOLDER
          </span>
        </Html>
      )}
    </group>
  )
}
