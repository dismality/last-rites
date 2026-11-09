// EnemyModels: draws every live zombie from the shared rigged zombie.glb.
// Rendering only; state and movement come from game/systems/enemyAI.ts via the enemy store.
// See docs/enemy-models.md for clips, pivots and the reverse-Death rise trick.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { BRUTE_MODEL_URL, ZOMBIE_MODEL_URL } from '../../data/assets'
import {
  BLOATER,
  BLOATER_SWELL_GROWTH,
  CRANE_FADE_S,
  ENEMY_DOWN_FALL_S,
  ENEMY_DYING_S,
  ENEMY_LOOKS,
  ENEMY_RISE_DEPTH_M,
  ENEMY_RISE_S,
  LURKER_TELEGRAPH_S,
  ZOMBIE_WALK_CLIP_SPEED,
  type EnemyId,
} from '../../data/enemies'
import { ELITE } from '../../data/elites'
import { useEnemyStore } from '../../game/state'
import { isSimFrozen } from '../../game/state/menuState'
import type { AIEnemy } from '../../game/systems/enemyAI'
import '../assets/preloadModels'
import { CraneProps } from './CraneProps'
import { EliteMarks } from './EliteMarks'

const FADE_S = 0.15
const MAX_DT = 0.1
/** Below this smoothed speed (m/s) a mover is drawn standing. */
const MOVING_SPEED = 0.25
const SPEED_SMOOTHING = 8

type ClipName =
  'Idle' | 'Walk' | 'Run' | 'Crawl' | 'Attack' | 'Lunge' | 'Threaten' | 'HitReact' | 'Death'

type PlayMode = 'loop' | 'once' | 'rise' | 'freeze' | 'down'

interface Pick {
  clip: ClipName
  mode: PlayMode
}

/** Maps an AI state to a clip (table in docs/enemy-models.md). */
function pickClip(e: AIEnemy, moving: boolean): Pick {
  switch (e.state) {
    case 'rise':
      return { clip: 'Death', mode: 'rise' }
    case 'dormant':
      return { clip: 'Idle', mode: 'freeze' }
    case 'chase':
      if (!moving) return { clip: 'Idle', mode: 'loop' }
      return { clip: e.type === 'lurker' ? 'Crawl' : 'Walk', mode: 'loop' }
    case 'lunge':
      return e.stateTime < LURKER_TELEGRAPH_S
        ? { clip: 'Threaten', mode: 'loop' }
        : { clip: 'Lunge', mode: 'loop' }
    case 'attack':
      return { clip: 'Attack', mode: 'loop' }
    case 'stagger':
      return { clip: 'HitReact', mode: 'once' }
    case 'keepDistance':
      return { clip: moving ? 'Walk' : 'Idle', mode: 'loop' }
    case 'scream':
      return { clip: 'Threaten', mode: 'loop' }
    case 'swell':
      return { clip: 'Threaten', mode: 'loop' }
    case 'down':
      // Knocked down: drop to the floor pose and hold it until the timer ends.
      return { clip: 'Death', mode: 'down' }
    case 'dying':
    case 'dead':
      // Lying down reuses the death clip; it ends on the floor pose.
      return { clip: 'Death', mode: 'once' }
  }
}

// The store replaces the enemies array every frame; index it once per array, not once per zombie.
let indexedFrom: readonly AIEnemy[] | null = null
const byUid = new Map<string, AIEnemy>()
function enemyByUid(uid: string): AIEnemy | undefined {
  const list = useEnemyStore.getState().enemies
  if (list !== indexedFrom) {
    byUid.clear()
    for (const e of list) byUid.set(e.uid, e)
    indexedFrom = list
  }
  return byUid.get(uid)
}

/** Clones share materials, so each enemy type gets its own tinted copy (made once). */
type TintCache = Map<string, THREE.Material>

function tintedMaterial(cache: TintCache, type: EnemyId, src: THREE.Material): THREE.Material {
  const key = `${type}:${src.uuid}`
  let m = cache.get(key)
  if (!m) {
    m = src.clone()
    const color = (m as THREE.MeshStandardMaterial).color
    if (color) color.multiply(new THREE.Color(ENEMY_LOOKS[type].tint))
    cache.set(key, m)
  }
  return m
}

/** Imperative scene-graph write, kept out of the component body. */
function setOpacity(mats: readonly THREE.Material[], opacity: number): void {
  for (const m of mats) m.opacity = opacity
}

interface ZombieProps {
  uid: string
  type: EnemyId
  scene: THREE.Group
  clips: readonly THREE.AnimationClip[]
  tints: TintCache
  /** Called once Father Crane's corpse has finished fading. */
  onFaded?: (uid: string) => void
}

function Zombie({ uid, type, scene, clips, tints, onFaded }: ZombieProps) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)

  // Father Crane is unique and fades, so his materials are private copies instead of the shared tints.
  const { root, ownMaterials } = useMemo(() => {
    const ownMaterials: THREE.Material[] = []
    // Plain .clone() would leave every copy sharing one skeleton.
    const obj = SkeletonUtils.clone(scene)
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      if (type === 'father-crane') {
        const m = tintedMaterial(tints, type, mesh.material as THREE.Material).clone()
        m.transparent = true
        ownMaterials.push(m)
        mesh.material = m
      } else {
        mesh.material = tintedMaterial(tints, type, mesh.material as THREE.Material)
      }
      // Bind-pose bounds are wrong once the rig falls or lunges.
      mesh.frustumCulled = false
      // Skinned shadows cost a pass each; the lantern's shadow budget is better spent on the world.
      mesh.castShadow = false
    })
    return { root: obj, ownMaterials }
  }, [scene, tints, type])

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root])
  const clipByName = useMemo(() => new Map(clips.map((c) => [c.name, c])), [clips])

  const current = useRef<{ clip: ClipName; mode: PlayMode; action: THREE.AnimationAction } | null>(
    null,
  )
  const lastPos = useRef<{ x: number; z: number } | null>(null)
  const speed = useRef(0)
  /** Kept so Crane's corpse still draws after the AI drops him from the store. */
  const lastSeen = useRef<AIEnemy | null>(null)
  const deathClock = useRef(0)
  const faded = useRef(false)
  /** Shared with CraneProps so the censer and stole fade with the body. */
  const propFade = useRef(1)

  useEffect(
    () => () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
      ownMaterials.forEach((m) => m.dispose())
    },
    [mixer, root, ownMaterials],
  )

  useFrame((_s, rawDelta) => {
    if (isSimFrozen()) return
    const live = enemyByUid(uid)
    if (live) lastSeen.current = live
    const e = live ?? lastSeen.current
    const o = outer.current
    const i = inner.current
    if (!e || !o || !i) return
    const dt = Math.min(rawDelta, MAX_DT)

    o.position.set(e.pos.x, 0, e.pos.z)
    o.rotation.y = e.yaw // models face +Z and yaw is atan2(dx, dz)

    const prev = lastPos.current
    if (prev && dt > 0) {
      const inst = Math.hypot(e.pos.x - prev.x, e.pos.z - prev.z) / dt
      speed.current += (inst - speed.current) * Math.min(1, dt * SPEED_SMOOTHING)
    }
    lastPos.current = { x: e.pos.x, z: e.pos.z }

    // Climb out of the soil while the rise state plays.
    const riseT = e.state === 'rise' ? Math.min(1, e.stateTime / ENEMY_RISE_S) : 1
    i.position.y = -(1 - riseT) * ENEMY_RISE_DEPTH_M

    // Swell: grow up to 35% over the swell time, then the burst removes the body.
    const base = ENEMY_LOOKS[type].scale
    const [bx, by, bz] = typeof base === 'number' ? [base, base, base] : base
    const swell =
      e.state === 'swell' ? 1 + BLOATER_SWELL_GROWTH * Math.min(1, e.stateTime / BLOATER.swellS) : 1
    const k = swell * (e.elite ? ELITE.scale : 1)
    i.scale.set(bx * k, by * k, bz * k)

    const pick = pickClip(e, speed.current > MOVING_SPEED)
    const want = clipByName.has(pick.clip) ? pick.clip : 'Idle'
    const cur = current.current
    if (!cur || cur.clip !== want || cur.mode !== pick.mode) {
      const clip = clipByName.get(want)
      if (clip) {
        const action = mixer.clipAction(clip)
        if (cur) cur.action.fadeOut(FADE_S)
        action.reset().setEffectiveWeight(1).fadeIn(FADE_S)
        action.paused = false
        if (pick.mode === 'once' || pick.mode === 'rise' || pick.mode === 'down') {
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity)
          action.clampWhenFinished = false
        }
        if (pick.mode === 'rise') {
          // Death played backwards: the zombie gets up instead of falling.
          action.timeScale = -clip.duration / ENEMY_RISE_S
          action.time = clip.duration
        } else if (pick.mode === 'down') {
          action.timeScale = clip.duration / ENEMY_DOWN_FALL_S
        } else if (want === 'Death') {
          action.timeScale = clip.duration / ENEMY_DYING_S
        } else {
          action.timeScale = 1
        }
        action.play()
        current.current = { clip: want, mode: pick.mode, action }
      }
    }

    const active = current.current
    if (active) {
      // Clips play on the spot, so match the stride to the real ground speed.
      if (active.clip === 'Walk' || active.clip === 'Crawl') {
        active.action.timeScale = THREE.MathUtils.clamp(
          speed.current / ZOMBIE_WALK_CLIP_SPEED,
          0.5,
          2,
        )
      }
      // A waiting lurker holds a single frame so it reads as a statue.
      if (active.mode === 'freeze') active.action.paused = true
    }
    mixer.update(dt)

    // Crane: the death clip is held on its last frame, then the body fades over 3 s.
    if (type === 'father-crane' && (e.state === 'dying' || e.state === 'dead')) {
      deathClock.current += dt
      const t = (deathClock.current - ENEMY_DYING_S) / CRANE_FADE_S
      const opacity = 1 - THREE.MathUtils.clamp(t, 0, 1)
      setOpacity(ownMaterials, opacity)
      propFade.current = opacity
      if (t >= 1 && !faded.current) {
        faded.current = true
        onFaded?.(uid)
      }
    }
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        <primitive object={root} />
        {type === 'father-crane' && <CraneProps fade={propFade} />}
      </group>
    </group>
  )
}

export function EnemyModels() {
  const zombie = useGLTF(ZOMBIE_MODEL_URL)
  const brute = useGLTF(BRUTE_MODEL_URL)
  // Crane's corpse outlives his store entry long enough to fade.
  const [ghosts, setGhosts] = useState<readonly { uid: string; type: EnemyId }[]>([])
  const tints = useMemo<TintCache>(() => new Map(), [])

  // Primitive string key: the list only re-renders when zombies appear or vanish, not every tick.
  const key = useEnemyStore((s) => s.enemies.map((e) => `${e.uid}|${e.type}`).join(','))
  const list = useMemo(
    () =>
      key === ''
        ? []
        : key.split(',').map((k) => {
            const [uid, type] = k.split('|')
            return { uid, type: type as EnemyId }
          }),
    [key],
  )

  useEffect(
    () =>
      useEnemyStore.subscribe((state, prev) => {
        const gone = prev.enemies.find(
          (e) =>
            e.type === 'father-crane' &&
            (e.state === 'dying' || e.state === 'dead') &&
            !state.enemies.some((s) => s.uid === e.uid),
        )
        if (gone) {
          setGhosts((g) =>
            g.some((x) => x.uid === gone.uid) ? g : [...g, { uid: gone.uid, type: gone.type }],
          )
        }
      }),
    [],
  )

  const onFaded = (uid: string) => setGhosts((g) => g.filter((x) => x.uid !== uid))
  const shown = [...list, ...ghosts.filter((g) => !list.some((z) => z.uid === g.uid))]

  useEffect(
    () => () => {
      tints.forEach((m) => m.dispose())
      tints.clear()
    },
    [tints],
  )

  return (
    <>
      {shown.map((z) => {
        const gltf = ENEMY_LOOKS[z.type].model === 'brute' ? brute : zombie
        return (
          <Zombie
            key={z.uid}
            uid={z.uid}
            type={z.type}
            scene={gltf.scene}
            clips={gltf.animations}
            tints={tints}
            onFaded={onFaded}
          />
        )
      })}
      <EliteMarks />
    </>
  )
}
