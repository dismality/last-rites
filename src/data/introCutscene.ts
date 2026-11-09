// Intro cutscene: five camera shots with text cards (docs/game-design.md §11).
// Pure data. Control points are Catmull-Rom points sampled by systems/cameraPath.ts.
// World axes: +X east, +Z south. The hut sits at the origin with its door in the +Z wall.

import { CHAPEL_CENTER, type Vec3 } from './cemeteryLayout'

export interface IntroShot {
  readonly id: 1 | 2 | 3 | 4 | 5
  /** Seconds. */
  readonly duration: number
  readonly camera: { readonly position: readonly Vec3[]; readonly target: readonly Vec3[] }
  /** Text card in the keeper's hand: shown `at` seconds into the shot for `hold` seconds. */
  readonly card: { readonly text: string; readonly at: number; readonly hold: number }
  /** Shot 4 only: soil thrown outward from this grave `at` seconds into the shot. */
  readonly burst?: { readonly x: number; readonly z: number; readonly at: number }
}

/** Dip to ink at every shot boundary; 0.5 s also keeps flashing-lights-off players comfortable. */
export const INTRO_FADE_S = 0.5

/** `grave-oak-hollow` spawn on the grounds (matches the open grave in shot 4). */
const OAK_HOLLOW_GRAVE = { x: -15, z: 12 } as const

const [CHAPEL_X, , CHAPEL_Z] = CHAPEL_CENTER

export const INTRO_SHOTS: readonly IntroShot[] = [
  {
    // Outside the south fence (z = 40), drifting north toward the gate line.
    id: 1,
    duration: 7,
    camera: {
      position: [
        [0, 2.5, 62],
        [0, 2.5, 56],
        [0, 2.4, 51],
        [0, 2.4, 46],
      ],
      target: [
        [0, 2.2, 30],
        [0, 2.2, 30],
        [0, 2.2, 30],
        [0, 2.2, 30],
      ],
    },
    card: { text: 'Hollowmere, October 1891.', at: 0.8, hold: 5 },
  },
  {
    // Inside the fence, above the headstones, over the gate toward the hut.
    id: 2,
    duration: 7,
    camera: {
      position: [
        [-4, 2.6, 38],
        [-3, 2.5, 31],
        [-2, 2.3, 25],
        [-1, 2.2, 20],
      ],
      target: [
        [0, 2, 3],
        [0, 2, 3],
        [0, 2, 3],
        [0, 2, 3],
      ],
    },
    card: {
      text: 'The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks.',
      at: 0.8,
      hold: 5.5,
    },
  },
  {
    // Sweeps past the chapel (x 7.5..12.5, z -1..11) on its open east and south sides.
    id: 3,
    duration: 7,
    camera: {
      position: [
        [4, 2.2, 15],
        [15, 2.4, 13.5],
        [17, 2.2, 5],
        [15, 2, -4],
      ],
      target: [
        [CHAPEL_X, 2.5, CHAPEL_Z],
        [CHAPEL_X, 2.5, CHAPEL_Z],
        [CHAPEL_X, 2.5, CHAPEL_Z],
        [CHAPEL_X, 2.5, CHAPEL_Z],
      ],
    },
    card: { text: 'They need someone to tend the dead.', at: 0.8, hold: 5 },
  },
  {
    // Looks down onto the oak-hollow grave; the camera is offset in z so the look is never vertical.
    id: 4,
    duration: 7,
    camera: {
      position: [
        [-15, 4.5, 17],
        [-15, 4, 15.5],
        [-15, 3.4, 14.5],
        [-15, 3, 14],
      ],
      target: [
        [OAK_HOLLOW_GRAVE.x, 0, OAK_HOLLOW_GRAVE.z],
        [OAK_HOLLOW_GRAVE.x, 0, OAK_HOLLOW_GRAVE.z],
        [OAK_HOLLOW_GRAVE.x, 0, OAK_HOLLOW_GRAVE.z],
        [OAK_HOLLOW_GRAVE.x, 0, OAK_HOLLOW_GRAVE.z],
      ],
    },
    card: { text: 'The graves here are opening. From the inside.', at: 1, hold: 5 },
    burst: { x: OAK_HOLLOW_GRAVE.x, z: OAK_HOLLOW_GRAVE.z, at: 2.5 },
  },
  {
    // Through the hut door (+Z wall, z = 3, 1.4 m wide, centred on x = 0) to the player's view of the bench.
    id: 5,
    duration: 7,
    camera: {
      position: [
        [0, 1.7, 9],
        [0, 1.65, 4.5],
        [0, 1.65, 1.8],
        [0, 1.65, 0],
      ],
      target: [
        [0, 1.6, -3],
        [0, 1.6, -3],
        [0, 1.65, -3],
        [0, 1.65, -3],
      ],
    },
    card: { text: 'Elias left a page on the shelf.', at: 0.8, hold: 5 },
  },
]

/**
 * Final camera pose. It MUST equal the player's spawn eye so the handover is seamless.
 * FirstPersonController: spawn feet [0, 0.05, 0] + eye 1.6 m above the feet = y 1.65;
 * yaw 0 and pitch 0 look along -Z, at the bench. Change both places together.
 */
export const INTRO_END_POSE: { readonly position: Vec3; readonly target: Vec3 } = {
  position: [0, 1.65, 0],
  target: [0, 1.65, -3],
}
