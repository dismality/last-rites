// The chapel's Blender scene data (spec 09 task 11n-a): the collision boxes and anchors that sit
// beside the two GLBs. Typed imports of the JSON files, so the scene and the tests read the very
// same numbers. All values are chapel-local game coordinates (add CHAPEL_CENTER for the world).

import interiorRaw from '../../public/assets/models/scene/chapel-interior-colliders.json'
import exteriorRaw from '../../public/assets/models/scene/chapel-exterior.json'
import { CHAPEL_CENTER, type Vec3 } from './cemeteryLayout'

export interface ChapelBox {
  /** Centre of the box (y is the middle), chapel-local. */
  readonly center: Vec3
  /** Half extents along the box's own axes. */
  readonly half: Vec3
  /** Rotation about Y, radians. Every chapel box is axis-aligned today. */
  readonly rotY: number
  /** The generator's name for it ("pew", "altar", "buttress"). */
  readonly note: string
}

const toBox = (b: { center: number[]; half: number[]; rotY: number; note: string }): ChapelBox => ({
  center: [b.center[0], b.center[1], b.center[2]],
  half: [b.half[0], b.half[1], b.half[2]],
  rotY: b.rotY,
  note: b.note,
})

/** Pews, lectern, font, vestry cupboard and altar, exactly as the generator wrote them. */
export const CHAPEL_INTERIOR_BOXES: readonly ChapelBox[] = interiorRaw.boxes.map(toBox)

/** The 14 buttress boxes outside the walls. The walls themselves keep the game's own colliders. */
export const CHAPEL_EXTERIOR_BOXES: readonly ChapelBox[] = exteriorRaw.boxes.map(toBox)

/**
 * Buttress colliders pulled in toward the wall (chapel-local x of the new outer face). The north
 * buttress on the west wall stood 0.64 m from the hut-ne -> hut-se leg, and zombies coming round
 * the chapel's north-west corner flipped between that leg and the direct line every few frames
 * (tests/zombieNavigation.test.ts, wg-northeast). Trimming its foot by 0.16 m clears it; the mesh
 * is unchanged and the box still covers the buttress's upper, tapered part.
 */
export const CHAPEL_BUTTRESS_TRIMS: readonly { readonly x: number; readonly z: number; readonly outerX: number }[] = [
  { x: -3, z: -5.9, outerX: -3.2 },
]

/** Heights things rest on, chapel-local metres (interior JSON "surfaces"). */
export const CHAPEL_SURFACES = {
  lecternBookRestY: interiorRaw.surfaces['lectern-book-rest-y'],
  fontLidY: interiorRaw.surfaces['font-lid-y'],
  pewSeatY: interiorRaw.surfaces['pew-seat-y'],
  cupboardShelfY: interiorRaw.surfaces['cupboard-shelf-y'],
  altarTopY: interiorRaw.surfaces['altar-top-y'],
} as const

/** Names of meshes in the GLBs the scene reacts to. */
export const CHAPEL_MESH = {
  stairCover: 'chapel-stair-cover',
  /** Steps, shaft walls, vault and the black end under the cover (spec 09 task 11n-e). */
  stair: 'chapel-stair',
  /** Every mesh whose name starts with this slides together when the stair opens. */
  altarPrefix: 'chapel-altar-',
  bell: 'chapel-ext-bell',
  /** Roof, ceiling and walls: the parts that shade the inside from the moon. */
  shadowCasters: ['chapel-ext-walls', 'chapel-ext-ceiling', 'chapel-ext-roof-timber', 'chapel-ext-slates'],
} as const

const vec3 = (p: number[]): Vec3 => [p[0], p[1], p[2]]

/** Chapel-local anchors from the exterior JSON. */
export const CHAPEL_ANCHORS = {
  doorLanternLight: vec3(exteriorRaw.anchors['door-lantern-light'].position),
  bellPivot: vec3(exteriorRaw.anchors['bell-pivot'].position),
} as const

/** Chapel-local point to world. */
export const toWorld = (p: Vec3): Vec3 => [
  p[0] + CHAPEL_CENTER[0],
  p[1] + CHAPEL_CENTER[1],
  p[2] + CHAPEL_CENTER[2],
]

/**
 * Where the east-wall hymn board hangs (world, facing west). The board is part of the interior GLB
 * and reads 4 · 19 · 2 · 41 · 23. Spec 10 task 4.3 puts the Hymn Board minigame's interactable here.
 */
export const HYMN_BOARD_POSITION: Vec3 = [12.47, 1.75, 8.7]
/** The numbers painted on the board, as docs/case-design.md §3 gives them. */
export const HYMN_BOARD_NUMBERS: readonly number[] = [4, 19, 2, 41, 23]

/**
 * The vestry psalter (spec 10 task 4.3): lies on the cupboard's shelf (top 0.88) beside the
 * revolver, which sits at z 7.6. The shelf spans z 7.1 to 8.1, so the book stays clear of its edge.
 */
export const PSALTER_POSITION: Vec3 = [7.9, 0.89, 7.95]

/** Where the five brass letter tiles lie on the altar top (y 1.0), as offsets from the altar's centre. */
export const HYMN_TILE_ROW = { spacing: 0.24, y: 1.02, forward: -0.15 } as const

/**
 * The catacomb stair under the cover (tools/blender/chapel_interior.py `stair()`), chapel-local.
 * The opening is x0..x1 and z0..innerBackZ; the steps run on under the end wall into the dark,
 * where the vault comes down to the steps, so only the part inside the chapel can be walked.
 */
export const CHAPEL_STAIR = {
  x0: -0.65,
  x1: 0.65,
  z0: 4.75,
  /** Inner face of the end wall: the opening in the floor stops here. */
  innerBackZ: 5.85,
  rise: 0.19,
  run: 0.27,
  steps: 12,
  /** Shaft wall thickness either side of the opening. */
  wallThickness: 0.2,
} as const

/**
 * The descent trigger (spec 09 task 11n-f), chapel-local: the lower part of the stair opening. The
 * feet must be below yMax = -0.5, about three steps down (the steps fall 0.19 m per 0.27 m), so
 * the player has plainly gone down before the screen fades. z1 is the end wall's inner face.
 */
export const STAIR_DESCENT = {
  x0: CHAPEL_STAIR.x0,
  x1: CHAPEL_STAIR.x1,
  /** Where the steps' surface passes y -0.5 (z 5.46): the trigger starts there. */
  z0: CHAPEL_STAIR.z0 + (0.5 * CHAPEL_STAIR.run) / CHAPEL_STAIR.rise,
  z1: CHAPEL_STAIR.innerBackZ,
  yMin: -3,
  yMax: -0.5,
} as const

/** Numbers of the stair descent and the altar slide's safety net (systems/stairDescent.ts). */
export const STAIR_RULES = {
  /** Feet height on arrival, as every spawn and teleport uses. */
  arrivalFeetY: 0.05,
  /** Arrival distance past the catacomb corridor's entrance line (0.4 m gate wall, then room to stand). */
  arrivalInset: 1.5,
  /** A position this far below the floor inside the opening is in the shaft. */
  shaftBelowY: -0.2,
  /** The controller keeps a 1 cm skin; overlap tests shave this much off the capsule radius. */
  radiusSlack: 0.03,
  /**
   * Feet below this are on the steps, not on the chapel floor. The capsule pressed against the end
   * wall hangs anywhere from 0.26 to 0.44 m down (browser probe), so the trigger reads the steps'
   * depth under the player, not the feet height.
   */
  onStepsBelowY: -0.1,
  /** Grid step of the nearest-free-spot search. */
  searchStep: 0.05,
} as const

/** Seconds of the descent: fade out, the held black (input locked, the player moved), fade in. */
export const STAIR_DESCENT_TIMING = { fadeOut: 0.6, black: 0.5, fadeIn: 0.8 } as const

/** When the stair opens the altar slides toward the door (-z) so it no longer sits over the opening. */
export const ALTAR_SLIDE = {
  distance: 0.6,
  seconds: 2,
} as const