// Placement of the Blender item models (docs/world-items.md): how big each one is, how it lies on
// the ground, where it sits in the hand and on its prop. The GLB files are never rotated or scaled;
// every transform lives here. Pure data: no logic beyond small lookups, no three.js.

import type { ItemId } from '../game/types'
import type { WeaponPickupId } from './weaponPickups'

type Vec3 = readonly [number, number, number]

/** Bounding-box size W x H x D in millimetres, in the model's own axes (docs/world-items.md). */
export const ITEM_MODEL_SIZE_MM: Readonly<Partial<Record<ItemId, Vec3>>> = {
  bone: [343, 62, 236],
  'iron-nail': [152, 51, 142],
  'candle-wax': [95, 76, 93],
  'holy-water': [38, 100, 36],
  cloth: [219, 35, 167],
  'lamp-oil': [165, 164, 96],
  'grave-salt': [184, 126, 134],
  'wood-plank': [625, 71, 181],
  'black-powder': [246, 123, 73],
  'lead-shot': [134, 92, 96],
  'silver-filings': [124, 21, 124],
  'revolver-cartridge': [118, 50, 77],
  'shotgun-shell': [88, 24, 101],
  'blessed-rounds': [34, 40, 35],
  'rusty-shovel': [210, 1417, 41],
  'sharpened-shovel': [210, 1422, 44],
  'bone-club': [135, 636, 132],
  'holy-water-flask': [124, 201, 59],
  'nail-bomb': [97, 162, 94],
  'lantern-trap': [584, 556, 292],
  'salt-circle': [1051, 100, 960],
  'tallow-candle': [184, 270, 150],
  bandage: [108, 59, 61],
  'lantern-refill': [66, 128, 67],
  revolver: [288, 182, 42],
  shotgun: [1121, 188, 57],
  'wood-axe': [197, 776, 35],
  'silver-sabre': [88, 912, 30],
  'kola-tonic': [58, 171, 57],
  'journal-page-1': [156, 26, 205],
  'journal-page-2': [156, 26, 205],
  'journal-page-3': [156, 26, 205],
  'journal-page-4': [156, 26, 205],
  'journal-page-5': [156, 26, 205],
  'parish-ledger': [241, 65, 343],
}

/** Item size in metres (W, H, D in model axes), or null for an item without a measured model. */
export function itemSizeM(id: ItemId): Vec3 | null {
  const mm = ITEM_MODEL_SIZE_MM[id]
  return mm ? [mm[0] / 1000, mm[1] / 1000, mm[2] / 1000] : null
}

// --- On the ground ----------------------------------------------------------

/** Real size is too small to spot from eye height (a nail is 15 cm), so ground items are enlarged. */
export const GROUND_SCALE_DEFAULT = 1.5
const GROUND_SCALE: Readonly<Partial<Record<ItemId, number>>> = {
  'wood-plank': 1,
  'journal-page-1': 2,
  'journal-page-2': 2,
  'journal-page-3': 2,
  'journal-page-4': 2,
  'journal-page-5': 2,
  'parish-ledger': 1.4,
}

export function groundScale(id: ItemId): number {
  return GROUND_SCALE[id] ?? GROUND_SCALE_DEFAULT
}

/**
 * Items modelled standing up (shovels grip +Y, club/axe/sabre grip -Y, guns barrel +X). Dropped
 * from the satchel they lie on their side: a quarter turn about X, which also turns the thin axis
 * (Z) to vertical. Everything else is modelled lying flat already.
 */
const UPRIGHT: ReadonlySet<ItemId> = new Set<ItemId>([
  'rusty-shovel',
  'sharpened-shovel',
  'bone-club',
  'wood-axe',
  'silver-sabre',
  'revolver',
  'shotgun',
])

export const LYING_ROTATION: Vec3 = [Math.PI / 2, 0, 0]
const NO_ROTATION: Vec3 = [0, 0, 0]

export interface GroundPose {
  readonly rotation: Vec3
  readonly scale: number
  /** Metres from the surface to the model's centre, so the model rests on the ground. */
  readonly lift: number
}

/** Ground scale, shrunk when needed so the longest edge stays within `maxEdgeM`. */
export function fitScale(id: ItemId, maxEdgeM: number): number {
  const size = itemSizeM(id)
  const longest = size ? Math.max(...size) : 0
  return longest > 0 ? Math.min(groundScale(id), maxEdgeM / longest) : groundScale(id)
}

/** Pose that rests the model on the surface under it. `scale` overrides the ground scale. */
export function groundPose(id: ItemId, scale: number = groundScale(id)): GroundPose {
  const size = itemSizeM(id)
  const lying = UPRIGHT.has(id)
  // Lying on its side, the model's depth (Z) becomes its height.
  const height = size ? (lying ? size[2] : size[1]) : 0.2
  return { rotation: lying ? LYING_ROTATION : NO_ROTATION, scale, lift: (height * scale) / 2 }
}

// --- Weapon pickups ---------------------------------------------------------

export interface WeaponPickupPose {
  /** Point on the prop's top surface the model rests on, relative to the pickup's origin. */
  readonly surface: Vec3
  /** Yaw about the vertical axis, applied on top of the lying rotation. */
  readonly yaw: number
  readonly scale: number
}

// Each weapon lies on its prop: the revolver on the cupboard top and the shotgun on the lodge table
// (both at y -0.03), the axe across the woodpile (top log at 0.67) and the sabre on the crypt step
// (top at -0.02). The scene adds groundPose().lift, so a thin model never floats or sinks.
export const WEAPON_PICKUP_POSES: Readonly<Record<WeaponPickupId, WeaponPickupPose>> = {
  revolver: { surface: [0, -0.03, 0], yaw: 0.35, scale: 1.5 },
  shotgun: { surface: [0, -0.03, 0], yaw: 0.3, scale: 0.8 },
  'wood-axe': { surface: [0, 0.67, 0], yaw: 0.5, scale: 1 },
  'silver-sabre': { surface: [0, -0.02, 0], yaw: 0.4, scale: 1 },
}

// --- In the hand ------------------------------------------------------------

/** Where the viewmodel group sits in the viewmodel camera's space (weapon points down -Z). */
export const HELD_ORIGIN = {
  position: [0.22, -0.18, -0.4] as Vec3,
  rotation: [0.1, -0.15, 0] as Vec3,
}

export interface HeldGrip {
  /** Model centre in the held group's space (metres). */
  readonly position: Vec3
  /** Euler XYZ in radians: turns the model's axes so the business end points down -Z. */
  readonly rotation: Vec3
  readonly scale: number
  /** Barrel tip in the held group's space, where the muzzle flash sits (guns only). */
  readonly muzzle?: Vec3
}

const HALF_TURN = Math.PI / 2

/**
 * Grip per held weapon. Shovels grip +Y so +Y turns to +Z (toward the player); club, axe and sabre
 * grip -Y so +Y turns to -Z (axe and sabre are also rolled a quarter turn about their length, so the blade stands edge-on to the swing); guns point their barrel +X, which a quarter turn about Y sends to -Z.
 * The grip end of each stays about 0.25 m (or less) behind the group origin, so it is always more
 * than 0.1 m in front of the camera (the near plane is 0.01).
 */
export const HELD_GRIPS = {
  'rusty-shovel': { position: [0, 0, -0.105], rotation: [HALF_TURN, 0, 0], scale: 0.5 },
  'sharpened-shovel': { position: [0, 0, -0.105], rotation: [HALF_TURN, 0, 0], scale: 0.5 },
  'bone-club': { position: [0, 0, -0.065], rotation: [-HALF_TURN, 0, 0], scale: 0.9 },
  'wood-axe': { position: [0, 0, -0.09], rotation: [-HALF_TURN, HALF_TURN, 0], scale: 0.8 },
  'silver-sabre': { position: [0, 0, -0.185], rotation: [-HALF_TURN, HALF_TURN, 0], scale: 0.8 },
  revolver: {
    position: [0, -0.03, -0.02],
    rotation: [0, HALF_TURN, 0],
    scale: 1.2,
    muzzle: [0, 0.05, -0.2],
  },
  shotgun: {
    position: [0, -0.01, -0.19],
    rotation: [0, HALF_TURN, 0],
    scale: 0.7,
    muzzle: [0, 0.04, -0.59],
  },
} as const satisfies Partial<Record<ItemId, HeldGrip>>

export type HeldModelId = keyof typeof HELD_GRIPS

export const HELD_MODEL_IDS = Object.keys(HELD_GRIPS) as HeldModelId[]

export function isHeldModelId(id: string | null): id is HeldModelId {
  return id !== null && (HELD_MODEL_IDS as readonly string[]).includes(id)
}
