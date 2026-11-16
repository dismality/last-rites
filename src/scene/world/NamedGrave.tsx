// Name the Dead (spec 10 task 11, Req 28): the grave glowing with a name this wave. An ember light
// and a stone slab mark it, with the name rune (ᛞ) and the name as a floating label, so it never
// reads by colour alone (Req 28.5). Holding Interact runs the hold in nameTheDeadStore.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { WAVE_GRAVES } from '../../data/waves'
import { NAME_ID_PREFIX } from '../../game/state/nameTheDeadStore'
import { useWaveStore } from '../../game/state/waveStore'
import { ACTION_RUNE } from '../../game/systems/interaction'
import { Interactable } from './Interactable'

const EMBER = '#e8913a'
const GLOW_INTENSITY = 6

/**
 * The ember light. Always mounted, as the scene's light count must stay constant: with no grave
 * lit (or once sealed) it is dark, otherwise it sits over the glowing grave.
 */
function GraveGlowLight() {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const { glow, sealed } = useWaveStore.getState()
    const grave = glow ? WAVE_GRAVES.find((g) => g.id === glow.graveId) : undefined
    const shut = glow !== null && sealed !== null && sealed.graveId === glow.graveId && sealed.wave === glow.wave
    l.intensity = grave && !shut ? GLOW_INTENSITY : 0
    if (grave) l.position.set(grave.x, 0.8, grave.z)
  })
  return <pointLight ref={light} color={EMBER} intensity={0} distance={7} decay={2} />
}

export function NamedGrave() {
  return (
    <>
      <GraveGlowLight />
      <GlowingGraveMarker />
    </>
  )
}

function GlowingGraveMarker() {
  const glow = useWaveStore((s) => s.glow)
  const sealed = useWaveStore((s) => s.sealed)
  if (glow === null) return null
  const grave = WAVE_GRAVES.find((g) => g.id === glow.graveId)
  if (!grave) return null
  const shut = sealed !== null && sealed.graveId === glow.graveId && sealed.wave === glow.wave
  return (
    <group position={[grave.x, 0, grave.z]}>
      <Interactable
        id={`${NAME_ID_PREFIX}${glow.graveId}`}
        kind="named-grave"
        subject={glow.graveId}
        runeHeight={2.1}
        runeScale={0.5}
        onInteract={() => {
          // Holding E names the grave (nameTheDeadStore); a press alone does nothing more.
        }}
      >
        {/* The slab over the grave mouth: dark, cracked open until it is sealed. */}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, shut ? 0 : 0.18]}>
          <planeGeometry args={[1.1, 2.2]} />
          <meshStandardMaterial color={shut ? '#5b5650' : '#2a2420'} roughness={1} side={THREE.DoubleSide} />
        </mesh>
        {/* Generous invisible target: raycasts ignore `visible`, so aim need not be exact. */}
        <mesh position={[0, 0.6, 0]} visible={false}>
          <boxGeometry args={[1.8, 1.2, 2.8]} />
          <meshBasicMaterial side={THREE.DoubleSide} />
        </mesh>
      </Interactable>
      <Html
        position={[0, 1.15, 0]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="named-grave-label" data-testid="named-grave-label" data-sealed={shut ? 'true' : 'false'}>
          <span className="named-grave-label__rune" aria-hidden="true">
            {ACTION_RUNE.name}
          </span>
          <span className="named-grave-label__name">{glow.name}</span>
          {shut && <span className="named-grave-label__state">sealed</span>}
        </div>
      </Html>
    </group>
  )
}
