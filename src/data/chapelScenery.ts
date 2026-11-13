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
