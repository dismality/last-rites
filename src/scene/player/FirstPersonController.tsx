// First-person controller: kinematic capsule driven by Rapier's character controller.
// Rules (speeds, clamps, bob) live in src/game/systems/movement.ts; this file only wires them up.

import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat'
import { useGameStore, useMapStore, usePlayerStore, useSettingsStore } from '../../game/state'
import { useCombatStore } from '../../game/state/combatStore'
import { useEffectStore } from '../../game/state/effectStore'
import { getDevCheats } from '../../game/state/devCheats'
import { takePlayerPush } from '../../game/state/playerPush'
import { takeTeleport } from '../../game/state/playerTeleport'
import {
  applyLook,
  headBobOffset,
  moveSpeed,
  moveVelocity,
  tickHeadBob,
  type BobState,
} from '../../game/systems/movement'
import { shakeMagnitude } from '../../game/systems/melee'
import { blockMoveMultiplier } from '../../game/systems/playerHealth'
import { dodgeVelocity } from '../../game/systems/dodge'
import { effectMods } from '../../game/systems/effects'
import {
  aimFovDeg,
  aimMoveMult,
  impactShakeAllowed,
  recoilOffsetRad,
} from '../../game/systems/recoil'
import { bodyRuntime } from './bodyRuntime'
import { weaponRuntime } from './weaponRuntime'
import { meleeRuntime } from './meleeRuntime'
import { scareRuntime } from '../scares/scareRuntime'
import { slowFactor } from '../../game/systems/scareStaging'
import { playerPositionRef } from '../world/playerPositionRef'
import { discardLookWhileOwned, isViewOwned } from './viewOwnership'
import { input, installInput } from './input'
import { useInteractionRaycast } from './useInteractionRaycast'

const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.5
/** Capsule centre height above the feet. */
const CENTRE_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS
/**
 * Eye level 1.6 m above the feet, relative to the capsule centre.
 * INTRO_END_POSE (data/introCutscene.ts) must equal the spawn eye: feet y 0.05 + 1.6 = 1.65.
 */
const EYE_OFFSET = 1.6 - CENTRE_Y
const GRAVITY = 9.81
/** Cap frame delta so a tab-switch hitch can't tunnel the player through geometry. */
const MAX_FRAME_DT = 0.1

interface Props {
  /** Feet position at spawn. */
  spawn?: [number, number, number]
}

export function FirstPersonController({ spawn = [0, 0.05, 0] }: Props) {
  const body = useRef<RapierRigidBody>(null)
  const controller = useRef<KinematicCharacterController | null>(null)
  const bob = useRef<BobState>({ phase: 0, amplitude: 0 })
  const fallSpeed = useRef(0)
  const { world, rapier } = useRapier()
  const canvas = useThree((s) => s.gl.domElement)
  useInteractionRaycast()

  useEffect(() => {
    const c = world.createCharacterController(0.01)
    c.setSlideEnabled(true)
    c.enableAutostep(0.3, 0.1, false)
    c.enableSnapToGround(0.3)
    controller.current = c
    return () => {
      world.removeCharacterController(c)
      controller.current = null
    }
  }, [world])

  useEffect(
    () => () => {
      bodyRuntime.body = null
      bodyRuntime.camera = null
      bodyRuntime.scene = null
      bodyRuntime.world = null
    },
    [],
  )

  useEffect(() => {
    const removeInput = installInput(canvas)
    // Re-locking the pointer is the way back into play after a pause.
    const onLockChange = () => {
      if (document.pointerLockElement === canvas) useGameStore.getState().setPaused(false)
    }
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      removeInput()
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [canvas])

  useFrame((state, rawDelta) => {
    const camera = state.camera
    const rb = body.current
    const kcc = controller.current
    if (!rb || !kcc) return
    bodyRuntime.body = rb
    bodyRuntime.camera = camera
    bodyRuntime.scene = state.scene
    bodyRuntime.world = world
    // Retry, Continue and New Game queue a move; apply it before anything reads the body, so
    // the stale position is never copied back into the store. Runs even while a menu is open.
    const tp = takeTeleport()
    if (tp) {
      const centre = { x: tp.position[0], y: tp.position[1] + CENTRE_Y, z: tp.position[2] }
      rb.setTranslation(centre, true)
      rb.setNextKinematicTranslation(centre)
      fallSpeed.current = 0
      bob.current = { phase: 0, amplitude: 0 }
      playerPositionRef.current.set(tp.position[0], tp.position[1], tp.position[2])
      camera.position.set(centre.x, centre.y + EYE_OFFSET, centre.z)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(tp.pitch, tp.yaw, 0)
    }
    // No movement or look while any menu holds the cursor. The workbench rig owns
    // the camera while opening, open and returning.
    // Mouse travel collected meanwhile is discarded, so it can't release as one big turn.
    if (discardLookWhileOwned(isViewOwned(), input)) return

    const dt = Math.min(rawDelta, MAX_FRAME_DT)
    const settings = useSettingsStore.getState()
    const player = usePlayerStore.getState()
    const snap = input.sample()

    const look = applyLook(
      player.yaw,
      player.pitch,
      snap.lookDX,
      snap.lookDY,
      settings.mouseSensitivity,
      settings.invertY,
    )

    // A grave hand holds the ankle: halve speed for its duration, then tick it down.
    const live = useCombatStore.getState().live
    const speed =
      moveSpeed(snap.sprint, player.stamina) *
      slowFactor(scareRuntime.slowLeft) *
      effectMods(useEffectStore.getState().effects).moveSpeed *
      aimMoveMult(weaponRuntime.aiming) *
      blockMoveMultiplier(live.blocking)
    scareRuntime.slowLeft = Math.max(0, scareRuntime.slowLeft - dt)
    scareRuntime.shakeAge += dt
    const walk = moveVelocity(look.yaw, snap.forward, snap.strafe, speed)
    // A running dodge replaces walking; Rapier still stops the dash at walls (Req 9.9).
    const dash = live.dodge ? dodgeVelocity(live.dodge) : null
    const vx = dash ? dash.x : walk[0]
    const vz = dash ? dash.z : walk[1]
    // The Toll's shove is a one-frame displacement, so the controller still honours walls.
    const push = takePlayerPush()

    const collider = rb.collider(0)
    const grounded = kcc.computedGrounded()
    fallSpeed.current = grounded ? 0 : fallSpeed.current + GRAVITY * dt
    // Scare zones are sensors: without this flag the controller treats them as walls, and every
    // item inside a zone (crypt key, whistle, relics, pages) becomes unreachable.
    const desired = {
      x: vx * dt + (push?.x ?? 0),
      y: -fallSpeed.current * dt,
      z: vz * dt + (push?.z ?? 0),
    }
    // Dev noclip (false unless src/dev/ sets it): glide through walls, no gravity.
    const noclip = getDevCheats().noclip
    if (!noclip) {
      kcc.computeColliderMovement(collider, desired, rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    }
    const m = noclip ? { x: desired.x, y: 0, z: desired.z } : kcc.computedMovement()
    const t = rb.translation()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    rb.setNextKinematicTranslation(next)

    const moving = vx !== 0 || vz !== 0
    bob.current = tickHeadBob(bob.current, dt, moving, settings.headBob)

    camera.position.set(next.x, next.y + EYE_OFFSET + headBobOffset(bob.current), next.z)
    camera.rotation.order = 'YXZ' // yaw first, then pitch, so looking up doesn't roll the view
    // Recoil is a visual kick on top of the player's own pitch; it is never written back.
    camera.rotation.set(look.pitch + recoilOffsetRad(weaponRuntime.recoil), look.yaw, 0)
    const fov = aimFovDeg(settings.fov, weaponRuntime.aimBlend)
    const perspective = camera as THREE.PerspectiveCamera
    if (perspective.isPerspectiveCamera && perspective.fov !== fov) {
      perspective.fov = fov
      perspective.updateProjectionMatrix()
    }
    // Hit shake is applied after the base pose and never written back to the player.
    const impact = impactShakeAllowed(settings.cameraShake, settings.scareIntensity)
      ? shakeMagnitude(scareRuntime.shakeAge)
      : 0
    const shake = Math.max(shakeMagnitude(meleeRuntime.shakeAge), impact)
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * 2 * shake
      camera.position.y += (Math.random() - 0.5) * 2 * shake
    }

    playerPositionRef.current.set(next.x, next.y - CENTRE_Y, next.z)
    // Only write the store when something changed, to spare subscribers.
    if (look.yaw !== player.yaw) player.setYaw(look.yaw)
    if (look.pitch !== player.pitch) player.setPitch(look.pitch)
    if (moving) {
      player.setPosition([next.x, next.y - CENTRE_Y, next.z])
      // Cheap and idempotent: only writes when the player enters a new 8 m cell.
      useMapStore.getState().reveal([next.x, next.y - CENTRE_Y, next.z])
    }
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      position={[spawn[0], spawn[1] + CENTRE_Y, spawn[2]]}
      colliders={false}
      canSleep={false}
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
    </RigidBody>
  )
}
