// Intro cutscene: five camera shots with text cards (docs/game-design.md §11). Shots 1-4 flow
// into one another as a single arrival; only the cut into the hut dips to ink.
// Pure data. Control points are Catmull-Rom points sampled by systems/cameraPath.ts.
// World axes: +X east, +Z south. The hut sits at the origin with its door in the +Z wall.

import type { Vec3 } from './cemeteryLayout'
import { SPAWN_YAW } from './spawn'

export interface IntroShot {
  readonly id: 1 | 2 | 3 | 4 | 5
  /** Seconds. */
  readonly duration: number
  readonly camera: { readonly position: readonly Vec3[]; readonly target: readonly Vec3[] }
  /** Text card in the keeper's hand: shown `at` seconds into the shot for `hold` seconds. */
  readonly card: { readonly text: string; readonly at: number; readonly hold: number }
  /** Shot 4 only: soil thrown outward from this grave `at` seconds into the shot. */
  readonly burst?: { readonly x: number; readonly z: number; readonly at: number }
  /**
   * True when this shot runs straight on into the next one: no dip to ink between them, and the
   * next shot starts on this one's last camera point and target.
   */
  readonly flow?: boolean
}

/** How far ahead of the eye the end pose looks (only the direction matters). */
const END_LOOK_M = 3
/** Where the intro's last frame looks: along SPAWN_YAW, level, toward the side table. */
const END_TARGET: Vec3 = [-Math.sin(SPAWN_YAW) * END_LOOK_M, 1.65, -Math.cos(SPAWN_YAW) * END_LOOK_M]

/** Dip to ink at the start, and at a shot boundary unless the shot flows on; 0.5 s also keeps flashing-lights-off players comfortable. */
export const INTRO_FADE_S = 0.5

/** `grave-oak-hollow` spawn on the grounds, where shot 4 comes to rest. */
const OAK_HOLLOW_GRAVE = { x: -15, z: 12 } as const

/** Where shots 1-3 look: the hut's door and lit window, at the end of the path. */
const HUT_DOOR_LOOK: Vec3 = [0, 1.6, 3]
/** Where the camera clears the front fence and joins the path (end of shot 1, start of shot 2). */
const HUT_PATH_ENTRY: Vec3 = [0, 2.9, 39]
/** Where the camera leaves the path for the graves (end of shot 2, start of shot 3). */
const PATH_TURN: Vec3 = [-1.8, 2.2, 24]
/** Where the drift slows over the graves (end of shot 3, start of shot 4). */
const GRAVE_APPROACH: Vec3 = [-11, 2.2, 16.5]
const OAK_HOLLOW_LOOK: Vec3 = [OAK_HOLLOW_GRAVE.x, 0, OAK_HOLLOW_GRAVE.z]

export const INTRO_SHOTS: readonly IntroShot[] = [
  // Shots 1-4 are one unbroken arrival: over the front fence, up the path towards the hut's lit
  // window, then drawn off the path across the untended graves to the oak-hollow grave. Only then a dip to ink, and the keeper's own eyes in the hut (shot 5).
  {
    // Outside the south fence (z = 40), rising over the railings towards the hut's lit window.
    id: 1,
    duration: 4,
    camera: {
      // Outside the front fence the ground climbs a bank (y 0 at z 44, about 0.9 at z 50), so the
      // shot starts about 1.7 m above the grass there and clears the 1.3 m railings at z 40.
      position: [
        [0, 2.6, 50],
        [0, 2.5, 46.5],
        [0, 2.7, 43],
        HUT_PATH_ENTRY,
      ],
      target: [HUT_DOOR_LOOK, HUT_DOOR_LOOK, HUT_DOOR_LOOK, HUT_DOOR_LOOK],
    },
    card: { text: 'Hollowmere, October 1891.', at: 0.4, hold: 3.4 },
    flow: true,
  },
  {
    // On up the path, still looking at the hut: where the missing keeper lived.
    id: 2,
    duration: 5,
    camera: {
      position: [HUT_PATH_ENTRY, [-0.4, 2.5, 34], [-1, 2.3, 29], PATH_TURN],
      target: [HUT_DOOR_LOOK, HUT_DOOR_LOOK, HUT_DOOR_LOOK, HUT_DOOR_LOOK],
    },
    card: {
      text: 'Elias Thorne, keeper of this cemetery, has been missing for three weeks.',
      at: 0.4,
      hold: 4.4,
    },
    flow: true,
  },
  {
    // Drawn off the path, across the untended headstones on the west side, towards the oak hollow.
    id: 3,
    duration: 5,
    camera: {
      position: [PATH_TURN, [-4.5, 2.1, 21], [-8, 2.1, 18.5], GRAVE_APPROACH],
      target: [HUT_DOOR_LOOK, [-4, 1.2, 7], [-11, 0.6, 10], OAK_HOLLOW_LOOK],
    },
    card: { text: 'The parish has sent you to take his place, and to find out what became of him.', at: 0.4, hold: 4.4 },
    flow: true,
  },
  {
    // Slows to a stop over the oak-hollow grave; the camera is offset in z so the look is never
    // vertical. Ends in ink.
    id: 4,
    duration: 4,
    camera: {
      position: [GRAVE_APPROACH, [-12.6, 2.5, 15.7], [-13.8, 2.8, 15.1], [-14.6, 3, 14.7]],
      target: [OAK_HOLLOW_LOOK, OAK_HOLLOW_LOOK, OAK_HOLLOW_LOOK, OAK_HOLLOW_LOOK],
    },
    card: { text: 'By day, follow his trail. By night, hold the grounds until dawn.', at: 0.4, hold: 3.4 },
  },
  {
    // Through the hut door (+Z wall, z = 3, 1.4 m wide, centred on x = 0) to the player's view of the bench.
    id: 5,
    duration: 4,
    camera: {
      position: [
        [0, 1.7, 9],
        [0, 1.65, 4.5],
        [0, 1.65, 1.8],
        [0, 1.65, 0],
      ],
      // Through the door looking ahead, then a turn to the side table with page 1 (B5).
      target: [
        [0, 1.6, -3],
        [0, 1.6, -3],
        [0, 1.65, -3],
        END_TARGET,
      ],
    },
    card: { text: 'He left a page on the table. Start there.', at: 0.4, hold: 3.4 },
  },
]

/**
 * Final camera pose. It MUST equal the player's spawn eye so the handover is seamless.
 * FirstPersonController: spawn feet [0, 0.05, 0] + eye 1.6 m above the feet = y 1.65;
 * the look follows SPAWN_YAW at pitch 0, toward page 1 on the side table (spec 09, B5).
 */
export const INTRO_END_POSE: { readonly position: Vec3; readonly target: Vec3 } = {
  position: [0, 1.65, 0],
  target: END_TARGET,
}
