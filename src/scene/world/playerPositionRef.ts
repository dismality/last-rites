// playerPositionRef — module-level mutable ref that the first-person controller
// writes each frame so Chapel and other proximity systems can read it.
//
// Lives in its own file so Chapel.tsx only exports React components and satisfies
// the react-refresh/only-export-components rule.

import * as THREE from 'three'

/** World-space player position, updated every frame by the first-person controller. */
export const playerPositionRef = { current: new THREE.Vector3(0, 0, 0) }