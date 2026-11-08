// First-person controller: kinematic capsule driven by Rapier's character controller.
// Rules (speeds, clamps, bob) live in src/game/systems/movement.ts; this file only wires them up.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat'
import { useGameStore, useMapStore, usePlayerStore, useSettingsStore } from '../../game/state'
import {
  applyLook,
  headBobOffset,
  moveSpeed,
  moveVelocity,
  tickHeadBob,
  type BobState,
} from '../../game/systems/movement'
import { shakeMagnitude } from '../../game/systems/melee'
import { meleeRuntime } from './meleeRuntime'
import { scareRuntime } from '../scares/scareRuntime'
import { slowFactor } from '../../game/systems/scareStaging'
import { playerPositionRef } from '../world/playerPositionRef'
import { endingCameraRuntime } from '../effects/endingCameraRuntime'
import { workbenchCameraRuntime } from '../world/workbenchCameraRuntime'
import { isMenuOpen } from '../../game/state/menuState'
import { input, installInput } from './input'
import { useInteractionRaycast } from './useInteractionRaycast'

const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.5
/** Capsule centre height above the feet. */
const CENTRE_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS
/** Eye level 1.6 m above the feet, relative to the capsule centre. */
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
  const { world } = useRapier()
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
    // No movement or look while any menu holds the cursor. The workbench rig owns
    // the camera while opening, open and returning.
    if (isMenuOpen() || workbenchCameraRuntime.active || endingCameraRuntime.active) return

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
      settings.invertY
    )

    // A grave hand holds the ankle: halve speed for its duration, then tick it down.
    const speed = moveSpeed(snap.sprint, player.stamina) * slowFactor(scareRuntime.slowLeft)
    scareRuntime.slowLeft = Math.max(0, scareRuntime.slowLeft - dt)
    scareRuntime.shakeAge += dt
    const [vx, vz] = moveVelocity(look.yaw, snap.forward, snap.strafe, speed)

    const collider = rb.collider(0)
    const grounded = kcc.computedGrounded()
    fallSpeed.current = grounded ? 0 : fallSpeed.current + GRAVITY * dt
    kcc.computeColliderMovement(collider, { x: vx * dt, y: -fallSpeed.current * dt, z: vz * dt })
    const m = kcc.computedMovement()
    const t = rb.translation()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    rb.setNextKinematicTranslation(next)

    const moving = vx !== 0 || vz !== 0
    bob.current = tickHeadBob(bob.current, dt, moving, settings.headBob)

    camera.position.set(next.x, next.y + EYE_OFFSET + headBobOffset(bob.current), next.z)
    camera.rotation.order = 'YXZ' // yaw first, then pitch, so looking up doesn't roll the view
    camera.rotation.set(look.pitch, look.yaw, 0)
    // Hit shake is applied after the base pose and never written back to the player.
    const shake = Math.max(shakeMagnitude(meleeRuntime.shakeAge), shakeMagnitude(scareRuntime.shakeAge))
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
