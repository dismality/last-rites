// <Interactable action="dig" onInteract={...}> wraps any object so the player can
// target and use it. Adds a faint pulse (rune sprite + glow) inside lantern range
// and a thin, faint edge frame + full rune on hover. The rune is the shape cue, so
// the highlight never depends on colour alone.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useLanternStore } from '../../game/state/lanternStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { ACTION_RUNE, isWithinLantern, type InteractAction } from '../../game/systems/interaction'
import { cinematicActive } from '../../game/state/menuState'
import { endingCameraRuntime } from '../effects/endingCameraRuntime'
import { introCameraRuntime } from '../effects/introCameraRuntime'
import { interactableRegistry } from './interactableRegistry'

const EMBER = '#e8913a'
// Hover frame: pale parchment edge lines at low opacity. drei <Outlines> on the transparent
// proxy box showed its whole back-face hull as solid walls, so plain edges are used instead.
const OUTLINE = '#f5d9a8'
const OUTLINE_OPACITY = 0.35
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
    // Named so the browser specs can find rune sprites in the scene graph.
    tex.name = `rune:${action}`
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
  const rune = useRef<THREE.SpriteMaterial>(null)
  const [hovered, setHovered] = useState(false)
  const handler = useRef(onInteract)
  const world = useMemo(() => new THREE.Vector3(), [])
  const map = useMemo(() => runeTexture(action), [action])
  const [sx, sy, sz] = size
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)),
    [sx, sy, sz],
  )
  useEffect(() => () => edges.dispose(), [edges])

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
    const hide = cinematicActive({
      ending: endingCameraRuntime.active,
      intro: introCameraRuntime.active,
    })
    const isHover = !hide && useInteractionStore.getState().hover?.id === key
    setHovered((h) => (h === isHover ? h : isHover))
    const animate = useSettingsStore.getState().flashingLights
    const t = state.clock.elapsedTime
    // Slow pulse; held steady when the flashing-lights setting is off.
    const pulse = animate ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0.5
    // No glow volume: an additive box read as a glowing crate. The rune pulses instead.
    if (rune.current) rune.current.opacity = isHover ? 1 : lit && !hide ? 0.25 + 0.3 * pulse : 0
  })

  return (
    <group ref={group}>
      {children}
      {/* Hover-only edge frame. raycast disabled so it never blocks the crosshair. */}
      {hovered && (
        <lineSegments name="hover-outline" geometry={edges} position={[0, sy / 2, 0]} raycast={() => null}>
          <lineBasicMaterial
            color={OUTLINE}
            transparent
            opacity={OUTLINE_OPACITY}
            depthWrite={false}
          />
        </lineSegments>
      )}
      <sprite position={[0, runeHeight, 0]} scale={[0.25, 0.25, 0.25]} raycast={() => null}>
        <spriteMaterial ref={rune} map={map} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  )
}
