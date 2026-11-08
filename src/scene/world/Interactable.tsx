// <Interactable action="dig" onInteract={...}> wraps any object so the player can
// target and use it. Adds a faint pulse (rune sprite + glow) inside lantern range
// and a stronger drei Outlines + rune on hover. The rune is the shape cue, so
// the highlight never depends on colour alone.

import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { useLanternStore } from '../../game/state/lanternStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { ACTION_RUNE, isWithinLantern, type InteractAction } from '../../game/systems/interaction'
import { interactableRegistry } from './interactableRegistry'

const EMBER = '#e8913a'
const runeTextures = new Map<InteractAction, THREE.CanvasTexture>()

/** Draws the rune glyph once per action; canvas keeps it offline and font-independent of the 3D layer. */
function runeTexture(action: InteractAction): THREE.CanvasTexture {
  let tex = runeTextures.get(action)
  if (!tex) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      g.font = '44px serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.shadowColor = EMBER
      g.shadowBlur = 10
      g.fillStyle = '#f5d9a8'
      g.fillText(ACTION_RUNE[action], 32, 34)
    }
    tex = new THREE.CanvasTexture(c)
    runeTextures.set(action, tex)
  }
  return tex
}

interface Props {
  action: InteractAction
  onInteract: () => void
  /** Unique id; generated if omitted. */
  id?: string
  /** Local half-size of the highlight box. */
  size?: [number, number, number]
  /** Height of the rune above the object's origin. */
  runeHeight?: number
  children?: ReactNode
}

export function Interactable({
  action,
  onInteract,
  id,
  size = [0.5, 0.5, 0.5],
  runeHeight = 0.8,
  children,
}: Props) {
  const autoId = useId()
  const key = id ?? autoId
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const rune = useRef<THREE.SpriteMaterial>(null)
  const hovered = useRef(false)
  const handler = useRef(onInteract)
  const world = useMemo(() => new THREE.Vector3(), [])
  const map = useMemo(() => runeTexture(action), [action])

  useEffect(() => {
    handler.current = onInteract
  }, [onInteract])

  useEffect(() => {
    const object = group.current
    if (!object) return
    object.userData.interactable = key
    interactableRegistry.set(key, { id: key, action, object, onInteract: () => handler.current() })
    return () => {
      interactableRegistry.delete(key)
    }
  }, [key, action])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.getWorldPosition(world)
    const dist = state.camera.position.distanceTo(world)
    const { fuel, on } = useLanternStore.getState()
    const lit = isWithinLantern(dist, fuel, on)
    const isHover = useInteractionStore.getState().hover?.id === key
    hovered.current = isHover
    const animate = useSettingsStore.getState().flashingLights
    const t = state.clock.elapsedTime
    // Slow pulse; held steady when the flashing-lights setting is off.
    const pulse = animate ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0.5
    // Kept faint: the outline and rune carry the highlight. A strong additive box reads as a glowing crate.
    const strength = isHover ? 0.07 + 0.04 * pulse : lit ? 0.015 + 0.03 * pulse : 0
    if (glow.current) glow.current.opacity = strength
    if (rune.current) rune.current.opacity = isHover ? 1 : lit ? 0.25 + 0.3 * pulse : 0
  })

  return (
    <group ref={group}>
      {children}
      {/* Proxy box: soft glow + outline. raycast disabled so it never blocks the crosshair. */}
      <mesh raycast={() => null} position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshBasicMaterial
          ref={glow}
          color={EMBER}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
        <Outlines thickness={0.02} color={EMBER} screenspace={false} />
      </mesh>
      <sprite position={[0, runeHeight, 0]} scale={[0.25, 0.25, 0.25]} raycast={() => null}>
        <spriteMaterial ref={rune} map={map} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  )
}
