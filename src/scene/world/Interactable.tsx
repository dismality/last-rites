// <Interactable kind="grave-mound" subject={graveId} onInteract={...}> wraps any object so the
// player can target and use it. Which cues it shows (prompt, rune pulse, hover frame, hand
// crosshair, targeting) comes from one rule: data/interactables.ts + systems/interactionCue.ts,
// fed with facts from state/cueFacts.ts. A cue shows only when pressing Interact right now would
// do something. Used-up objects fade every cue (and, for items you take, their own meshes) over
// CUE_FADE_S and stop being targeted. The rune is the shape cue, so the highlight never depends
// on colour alone.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INTERACTABLES, type InteractableKind } from '../../data/interactables'
import { readCueFacts } from '../../game/state/cueFacts'
import { useLanternStore } from '../../game/state/lanternStore'
import { useInteractionStore } from '../../game/state/interactionStore'
import { useSettingsStore } from '../../game/state/settingsStore'
import { useWorldStore } from '../../game/state/worldStore'
import { ACTION_RUNE, isRuneVisible, type InteractAction } from '../../game/systems/interaction'
import { fadeAlpha, interactionCue, type InteractionCue } from '../../game/systems/interactionCue'
import { cinematicActive } from '../../game/state/menuState'
import { endingCameraRuntime } from '../effects/endingCameraRuntime'
import { introCameraRuntime } from '../effects/introCameraRuntime'
import { interactableRegistry } from './interactableRegistry'

const EMBER = '#e8913a'
// Highlight: an inverted hull. The object's own meshes are drawn again, a little larger, as flat
// unlit pale-parchment back faces behind the object, so the glow hugs its real shape (no box, no
// wireframe, no light). Sized from the meshes' bounds so it follows whatever model is shown.
const OUTLINE = '#f5d9a8'
const OUTLINE_OPACITY = 0.6
/** Hull thickness as a fraction of the object's largest side, kept within a readable range (m). */
const HULL_FRACTION = 0.05
const HULL_MIN_M = 0.03
const HULL_MAX_M = 0.06
/** Sides shorter than this scale by this much, so a flat sheet does not blow up. */
const HULL_SIDE_FLOOR_M = 0.15
/** Proximity outlines reach full strength this far inside their range. */
const OUTLINE_FADE_BAND_M = 1

/**
 * Fills `hull` with flat copies of every mesh under `body`, placed so the whole set is scaled
 * about the bounds centre by (side + 2 t) / side. Positions are in `root`'s space.
 */
function buildHull(
  root: THREE.Object3D,
  body: THREE.Object3D,
  hull: THREE.Group,
  material: THREE.Material,
): void {
  hull.clear()
  hull.position.set(0, 0, 0)
  hull.scale.set(1, 1, 1)
  root.updateWorldMatrix(true, false)
  body.updateWorldMatrix(true, true)
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const bounds = new THREE.Box3()
  const parts: { mesh: THREE.Mesh; rel: THREE.Matrix4 }[] = []
  body.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const rel = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld)
    bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(rel))
    parts.push({ mesh, rel })
  })
  if (bounds.isEmpty()) return
  const size = bounds.getSize(new THREE.Vector3())
  const centre = bounds.getCenter(new THREE.Vector3())
  const t = Math.min(HULL_MAX_M, Math.max(HULL_MIN_M, HULL_FRACTION * Math.max(size.x, size.y, size.z)))
  hull.position.copy(centre)
  hull.scale.set(
    1 + (2 * t) / Math.max(size.x, HULL_SIDE_FLOOR_M),
    1 + (2 * t) / Math.max(size.y, HULL_SIDE_FLOOR_M),
    1 + (2 * t) / Math.max(size.z, HULL_SIDE_FLOOR_M),
  )
  const recentre = new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z)
  for (const { mesh, rel } of parts) {
    const copy = new THREE.Mesh(mesh.geometry, material)
    copy.matrixAutoUpdate = false
    copy.matrix.multiplyMatrices(recentre, rel)
    copy.raycast = () => null
    hull.add(copy)
  }
}
/** Beyond this the cue is not computed: runes only show inside lantern or day range. */
const CUE_RANGE_M = 40
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

type Mat = THREE.Material | THREE.Material[]

/** Swaps a body's materials for transparent clones so fading never touches shared materials. */
class BodyFade {
  private originals = new Map<THREE.Mesh, Mat>()
  private base = new Map<THREE.Material, number>()

  get active(): boolean {
    return this.originals.size > 0
  }

  begin(root: THREE.Object3D): void {
    if (this.active) return
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      this.originals.set(mesh, mesh.material)
      const cloneOne = (m: THREE.Material): THREE.Material => {
        const c = m.clone()
        this.base.set(c, m.opacity)
        c.transparent = true
        return c
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneOne) : cloneOne(mesh.material)
    })
  }

  set(alpha: number): void {
    for (const [mesh] of this.originals) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) m.opacity = (this.base.get(m) ?? 1) * alpha
    }
  }

  end(): void {
    for (const [mesh, original] of this.originals) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mesh.material = original
      for (const m of mats) m.dispose()
    }
    this.originals.clear()
    this.base.clear()
  }
}

interface Props {
  /** Row of data/interactables.ts: sets the action, the category and the prompt wording. */
  kind: InteractableKind
  /** Which instance of the kind (grave id, clue id, `spawn:index`, ...). Read by cueFacts. */
  subject?: string
  /** Force the used-up state: a ghost kept mounted for the fade after the world removed the object. */
  usedUp?: boolean
  onInteract: () => void
  /** Called once when the object becomes used up in front of the player. */
  onUsedUp?: () => void
  /** Unique id; generated if omitted. */
  id?: string
  /**
   * Show the outline (not only on hover) within this many metres while the object can be used,
   * fading in over the last metre. Clue spots use 4 m.
   */
  outlineRange?: number
  /** Height of the rune above the object's origin. */
  runeHeight?: number
  /** Rune scale; large targets seen from afar (grave mounds) use a bigger glyph. */
  runeScale?: number
  /** Also show the rune by day within this many metres even with the lantern off. */
  dayRuneRange?: number
  children?: ReactNode
}

export function Interactable({
  kind,
  subject = '',
  usedUp: forcedUsedUp = false,
  onInteract,
  onUsedUp,
  id,
  outlineRange,
  runeHeight = 0.8,
  runeScale = 0.25,
  dayRuneRange,
  children,
}: Props) {
  const def = INTERACTABLES[kind]
  const action = def.action
  const autoId = useId()
  const key = id ?? autoId
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const rune = useRef<THREE.SpriteMaterial>(null)
  const hull = useRef<THREE.Group>(null)
  // Created with each hull (below) and read per frame; null while no outline is showing.
  const outlineMat = useRef<THREE.MeshBasicMaterial | null>(null)
  const [outlineOn, setOutlineOn] = useState(false)
  const handler = useRef(onInteract)
  const usedHandler = useRef(onUsedUp)
  const forced = useRef(forcedUsedUp)
  const subjectRef = useRef(subject)
  const bodyFade = useMemo(() => new BodyFade(), [])
  // Fade bookkeeping, per frame and never rendered: null until the first computed frame.
  const fade = useRef<{
    used: boolean | null
    startedAt: number
    runeFrom: number
    outlineFrom: number
  }>({ used: null, startedAt: -Infinity, runeFrom: 0, outlineFrom: 0 })
  const world = useMemo(() => new THREE.Vector3(), [])
  const map = useMemo(() => runeTexture(action), [action])
  // Rebuild the hull each time it appears, so it follows whichever meshes the body holds now.
  useEffect(() => {
    if (!outlineOn || !group.current || !body.current || !hull.current) return
    const material = new THREE.MeshBasicMaterial({
      color: OUTLINE,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    })
    outlineMat.current = material
    buildHull(group.current, body.current, hull.current, material)
    return () => {
      outlineMat.current = null
      material.dispose()
    }
  }, [outlineOn])

  useEffect(() => {
    handler.current = onInteract
    usedHandler.current = onUsedUp
    forced.current = forcedUsedUp
    subjectRef.current = subject
  }, [onInteract, onUsedUp, forcedUsedUp, subject])

  useEffect(() => () => bodyFade.end(), [bodyFade])

  /** The one cue rule, read fresh: used by this component's frame, the raycast and the HUD. */
  const cueNow = useRef<() => InteractionCue>(() => interactionCue(kind, { usedUp: true }, { keyCode: 'KeyE', flashingLights: true }))
  useEffect(() => {
    cueNow.current = () => {
      const s = useSettingsStore.getState()
      return interactionCue(
        kind,
        forced.current ? { usedUp: true } : readCueFacts(kind, subjectRef.current),
        { keyCode: s.bindings.Interact ?? 'KeyE', flashingLights: s.flashingLights },
      )
    }
  }, [kind])

  useEffect(() => {
    const object = group.current
    if (!object) return
    object.userData.interactable = key
    interactableRegistry.set(key, {
      id: key,
      action,
      object,
      onInteract: () => handler.current(),
      cue: () => cueNow.current(),
    })
    return () => {
      interactableRegistry.delete(key)
    }
  }, [key, action])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.getWorldPosition(world)
    const dist = state.camera.position.distanceTo(world)
    if (dist > CUE_RANGE_M) {
      if (rune.current) rune.current.opacity = 0
      return
    }
    const t = state.clock.elapsedTime
    const cue = cueNow.current()
    g.userData.targetable = cue.targetable
    const f = fade.current
    const used = cue.fade !== null
    const hide = cinematicActive({
      ending: endingCameraRuntime.active,
      intro: introCameraRuntime.active,
    })
    const isHover = !hide && cue.targetable && useInteractionStore.getState().hover?.id === key
    const { fuel, on } = useLanternStore.getState()
    const lit = isRuneVisible({
      distance: dist,
      fuel,
      lanternOn: on,
      day: useWorldStore.getState().phase === 'day',
      dayRuneRangeM: dayRuneRange,
    })
    const animate = useSettingsStore.getState().flashingLights
    // Slow pulse; held steady when the flashing-lights setting is off.
    const pulse = animate ? 0.5 + 0.5 * Math.sin(t * 2.4) : 0.5
    const pulseLevel = lit && !hide
      ? dayRuneRange !== undefined
        ? 0.55 + 0.35 * pulse // daylight washes out the faint pulse; keep mounds readable
        : 0.25 + 0.3 * pulse
      : 0

    // Edges: first frame, or the object just became used up / usable again.
    if (f.used === null) {
      f.used = used
      // Already used when first seen (a loaded run, a dug grave): no fade to play. A ghost kept
      // mounted for the fade starts at full strength instead.
      f.startedAt = used && !forced.current ? -Infinity : t
      f.runeFrom = pulseLevel
      f.outlineFrom = isHover ? 1 : 0
    } else if (used !== f.used) {
      f.used = used
      if (used) {
        f.startedAt = t
        f.runeFrom = rune.current && rune.current.opacity > 0 ? rune.current.opacity : pulseLevel
        f.outlineFrom = outlineMat.current ? 1 : 0
        usedHandler.current?.()
      } else {
        bodyFade.end()
        if (body.current) body.current.visible = true
      }
    }

    const alpha = cue.fade ? fadeAlpha(t - f.startedAt, cue.fade.durationS, cue.fade.steady) : 1
    g.userData.cueAlpha = alpha

    if (def.fadesBody && body.current) {
      if (used) {
        if (alpha < 1) bodyFade.begin(body.current)
        if (bodyFade.active) bodyFade.set(alpha)
        body.current.visible = alpha > 0
      }
    }

    // Proximity outline (clue spots): fades in over the last metre of `outlineRange`, only while
    // examining would do something. A steady fade, never a pulse, so it suits every comfort setting.
    const near =
      outlineRange !== undefined && !used && !hide && cue.targetable
        ? Math.min(1, Math.max(0, (outlineRange - dist) / OUTLINE_FADE_BAND_M))
        : 0
    const wantOutline = isHover || near > 0 || (used && f.outlineFrom > 0 && alpha > 0 && !hide)
    setOutlineOn((o) => (o === wantOutline ? o : wantOutline))
    if (outlineMat.current) outlineMat.current.opacity = OUTLINE_OPACITY * (used ? alpha : isHover ? 1 : near)

    if (rune.current) {
      rune.current.opacity = used
        ? hide
          ? 0
          : f.runeFrom * alpha
        : isHover
          ? 1
          : cue.pulse
            ? pulseLevel
            : 0
    }
  })

  return (
    <group ref={group}>
      <group ref={body}>{children}</group>
      {/* Inverted-hull outline of the body's own meshes (fades with the object once used up). Its meshes have raycast disabled so they never block the crosshair. */}
      {outlineOn && <group ref={hull} name="hover-outline" />}
      <sprite position={[0, runeHeight, 0]} scale={[runeScale, runeScale, runeScale]} raycast={() => null}>
        <spriteMaterial ref={rune} map={map} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  )
}
