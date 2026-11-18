// First-person hands and lantern models (spec 11 H7, tasks 6.4 and 6.5). Each file is probed first;
// a missing one is listed in the Waiting_List and today's weapon-only viewmodel stands in (Req 7.7).
// The boundary catches a file that is present but broken.
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { DRACO_PATH, HANDS_MODEL_URL, LANTERN_MODEL_URL } from '../../data/assets'
import { GRIP_CLIPS, HANDS_CLIPS, VIEWMODEL_TIMING } from '../../data/viewmodel'
import { registerMissingArt } from '../../game/state/waitingList'
import { useAssetOrPlaceholder } from '../assets/useAssetOrPlaceholder'
import { handsRuntime, lanternHandRuntime } from './lanternRig'

/** Renders nothing if its child throws (a missing or broken model file). Boundaries must be classes. */
class AssetBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    // A file that exists but cannot be decoded is also waiting for art; the weapon-only viewmodel stands in.
    registerMissingArt(this.props.path)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function HandsRig() {
  const { scene, animations } = useGLTF(HANDS_MODEL_URL, DRACO_PATH)
  const object = useMemo(() => {
    const clone = SkeletonUtils.clone(scene)
    clone.traverse((o) => (o.frustumCulled = false))
    return clone
  }, [scene])
  const { actions } = useAnimations(animations, object)
  const grip = useRef<string | null>(null)
  const holding = useRef(false)
  const throwSerial = useRef(handsRuntime.throwSerial)

  useEffect(() => {
    // Let the next frame pick the clips again after a reload of the actions.
    grip.current = null
    holding.current = false
  }, [actions])

  useFrame(() => {
    const blend = VIEWMODEL_TIMING.gripBlendS
    const gripName = GRIP_CLIPS[handsRuntime.grip]
    if (grip.current !== gripName) {
      if (grip.current) actions[grip.current]?.fadeOut(blend)
      actions[gripName]?.reset().fadeIn(blend).play()
      grip.current = gripName
    }
    // The left hand carries the lantern unless it is on the shotgun fore-end.
    const wantHold = lanternHandRuntime.hand.mode !== 'belt'
    if (wantHold !== holding.current) {
      const hold = actions[HANDS_CLIPS.lanternHold]
      if (wantHold) hold?.reset().fadeIn(blend).play()
      else hold?.fadeOut(blend)
      holding.current = wantHold
    }
    if (throwSerial.current !== handsRuntime.throwSerial) {
      throwSerial.current = handsRuntime.throwSerial
      const t = actions[HANDS_CLIPS.throw]
      if (t) {
        t.reset().setLoop(THREE.LoopOnce, 1).play()
      }
    }
  })

  return <primitive object={object} />
}

function LanternModel() {
  const { scene } = useGLTF(LANTERN_MODEL_URL, DRACO_PATH)
  const object = useMemo(() => scene.clone(true), [scene])
  return <primitive object={object} />
}

export function ViewmodelHands() {
  const status = useAssetOrPlaceholder(HANDS_MODEL_URL)
  // PLACEHOLDER: /assets/models/viewmodel/hands.glb (nothing is drawn: the weapon-only viewmodel is the stand-in)
  if (status !== 'present') return null
  return (
    <AssetBoundary path={HANDS_MODEL_URL}>
      <Suspense fallback={null}>
        <HandsRig />
      </Suspense>
    </AssetBoundary>
  )
}

export function ViewmodelLantern() {
  const status = useAssetOrPlaceholder(LANTERN_MODEL_URL)
  // PLACEHOLDER: /assets/models/viewmodel/lantern.glb (nothing is drawn; the light keeps its fixed camera offset from LANTERN_ANCHORS)
  if (status !== 'present') return null
  return (
    <AssetBoundary path={LANTERN_MODEL_URL}>
      <Suspense fallback={null}>
        <LanternModel />
      </Suspense>
    </AssetBoundary>
  )
}