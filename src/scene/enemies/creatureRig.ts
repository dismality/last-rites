// The animation and material rig behind each new creature (spec 11 H2): a skeleton-safe clone of
// the model, its tint, the clip crossfade and the fade. Rendering only; no game rules.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { ENEMY_LOOKS } from '../../data/enemies'
import type { CreatureId } from '../../data/creatures'

export type CreatureClip =
  'Idle' | 'Walk' | 'Run' | 'Crawl' | 'Attack' | 'Lunge' | 'Threaten' | 'HitReact' | 'Death'

const FADE_S = 0.15

export interface LoadedModel {
  scene: THREE.Group
  clips: readonly THREE.AnimationClip[]
  /** True while the zombie model stands in for the missing file. */
  placeholder: boolean
}

/** The look's scale as three numbers. A real model is authored at its own size, so it gets 1. */
export function lookScale(id: CreatureId, placeholder: boolean): [number, number, number] {
  if (!placeholder) return [1, 1, 1]
  const s = ENEMY_LOOKS[id].scale
  return typeof s === 'number' ? [s, s, s] : [s[0], s[1], s[2]]
}

export class CreatureRig {
  readonly root: THREE.Object3D
  private readonly mixer: THREE.AnimationMixer
  private readonly byName: Map<string, THREE.AnimationClip>
  private readonly materials: THREE.Material[] = []
  private readonly warned = new Set<string>()
  private current: { name: string; action: THREE.AnimationAction } | null = null

  constructor(
    private readonly id: CreatureId,
    model: LoadedModel,
    transparent: boolean,
  ) {
    this.root = SkeletonUtils.clone(model.scene)
    const tint = new THREE.Color(ENEMY_LOOKS[id].tint)
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      // Own copy, so the shared glTF material is never changed and a fade touches this body only.
      const m = (mesh.material as THREE.Material).clone()
      const std = m as THREE.MeshStandardMaterial
      // A real model keeps the colours it was made with (spec 11 Req 3.9).
      if (model.placeholder && std.color) std.color.multiply(tint)
      if (transparent) m.transparent = true
      this.materials.push(m)
      mesh.material = m
      mesh.frustumCulled = false // bind-pose bounds are wrong once the rig moves
      mesh.castShadow = false
    })
    this.mixer = new THREE.AnimationMixer(this.root)
    this.byName = new Map(model.clips.map((c) => [c.name, c]))
  }

  /** Crossfades to `clip` (Idle when the model lacks it, with one warning). Repeating a clip is free. */
  play(clip: CreatureClip, timeScale = 1): void {
    let want: string = clip
    if (!this.byName.has(want)) {
      if (!this.warned.has(want)) {
        this.warned.add(want)
        console.warn(`creature ${this.id}: model has no "${want}" clip, using Idle`)
      }
      want = 'Idle'
    }
    const next = this.byName.get(want)
    if (!next) return
    if (this.current && this.current.name === want) {
      this.current.action.timeScale = timeScale
      return
    }
    const action = this.mixer.clipAction(next)
    action.reset().setEffectiveWeight(1).fadeIn(FADE_S)
    action.timeScale = timeScale
    action.play()
    this.current?.action.fadeOut(FADE_S)
    this.current = { name: want, action }
  }

  update(dt: number): void {
    this.mixer.update(dt)
  }

  /** 0..1; the materials must have been made transparent. */
  setOpacity(opacity: number): void {
    const o = Math.min(1, Math.max(0, opacity))
    for (const m of this.materials) {
      m.opacity = o
      m.depthWrite = o >= 0.99
    }
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
    this.materials.forEach((m) => m.dispose())
  }
}

/** One rig per mounted creature, released when it unmounts. */
export function useCreatureRig(id: CreatureId, model: LoadedModel, transparent = false): CreatureRig {
  const rig = useMemo(() => new CreatureRig(id, model, transparent), [id, model, transparent])
  useEffect(() => () => rig.dispose(), [rig])
  return rig
}
