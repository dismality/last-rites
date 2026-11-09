// Live handles to the mounted first-person rig, so tests can read where the Rapier body and the
// camera really are (the player store is only a mirror and can disagree with the body).
// The controller sets these every frame and clears them on unmount. Nothing in the game reads them.

import type * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'

export const bodyRuntime: {
  body: RapierRigidBody | null
  camera: THREE.Camera | null
  scene: THREE.Scene | null
} = { body: null, camera: null, scene: null }
