// The remaining props' Blender data (spec 09 task 11n-d): the colliders, anchors and surfaces that
// sit beside each GLB. Typed imports of the JSON, so the scene and the tests read the same numbers.
// Every box is in the prop's own space (centre, half extents, rotY).

import lampRaw from '../../public/assets/models/props/lamp-post.json'
import cartRaw from '../../public/assets/models/props/merchant-cart.json'
import statueRaw from '../../public/assets/models/props/statue-mourner.json'
import woodRaw from '../../public/assets/models/props/woodpile.json'
import tableRaw from '../../public/assets/models/props/lodge-table.json'
import plinthRaw from '../../public/assets/models/props/sabre-plinth.json'
import ledgerRaw from '../../public/assets/models/props/clue-ledger-week.json'
import batPerchedRaw from '../../public/assets/models/props/bat-perched.json'
import batFlyingRaw from '../../public/assets/models/props/bat-flying.json'
import { LODGE, WOODPILE_POSITION, type Vec3 } from './cemeteryLayout'
import { SCARE_STATUES } from './scares'
import { CLUE_SPOTS } from './tombstones'

export interface PropBox {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotY: number
  readonly note: string
}

type RawBox = { center: number[]; half: number[]; rotY: number; note: string }

const boxes = (raw: readonly RawBox[]): readonly PropBox[] =>
  raw.map((b) => ({
    center: [b.center[0], b.center[1], b.center[2]],
    half: [b.half[0], b.half[1], b.half[2]],
    rotY: b.rotY,
    note: b.note,
  }))

const at = (p: readonly number[]): Vec3 => [p[0], p[1], p[2]]

/** Props that gain a collider the game did not have. Placed with the prop's own transform. */
export const STATUE_BOXES = boxes(statueRaw.boxes)
export const WOODPILE_BOXES = boxes(woodRaw.boxes)
export const LODGE_TABLE_BOXES = boxes(tableRaw.boxes)
export const NOTICE_POST_BOXES = boxes(ledgerRaw.boxes)
/** The cart's body, for the tests (the merchant stands in the open, so the game adds no collider). */
export const CART_BOXES = boxes(cartRaw.boxes)
export const LAMP_POST_BOXES = boxes(lampRaw.boxes)
export const SABRE_PLINTH_BOXES = boxes(plinthRaw.boxes)

export interface PropPlacement {
  /** World centre of the box (y is the middle). */
  readonly position: Vec3
  readonly half: Vec3
  readonly rotY: number
  readonly note: string
}

const place = (origin: Vec3, list: readonly PropBox[], tag: string): PropPlacement[] =>
  list.map((b) => ({
    position: [origin[0] + b.center[0], origin[1] + b.center[1], origin[2] + b.center[2]],
    half: b.half,
    rotY: b.rotY,
    note: `${tag}:${b.note}`,
  }))

/** The colliders this task added, in world space: statues, woodpile, lodge table, notice post. */
export const PROP_PLACEMENTS: readonly PropPlacement[] = [
  ...SCARE_STATUES.flatMap((s) => place(s.position, STATUE_BOXES, `statue ${s.zoneId}`)),
  ...place(WOODPILE_POSITION, WOODPILE_BOXES, 'woodpile'),
  ...place(LODGE.center, LODGE_TABLE_BOXES, 'lodge table'),
  ...CLUE_SPOTS.filter((c) => c.clueId === 'clue-ledger-week').flatMap((c) =>
    place(c.position, NOTICE_POST_BOXES, 'notice post'),
  ),
]

/** Light spots and seats, in prop-local space. */
export const LAMP_LIGHT: Vec3 = at(lampRaw.anchors.light.position)
export const CART_LANTERN: Vec3 = at(cartRaw.anchors.lantern.position)
/** Where the axe rests on the woodpile, blade toward the chopping block. */
export const AXE_REST: Vec3 = at(woodRaw.anchors['axe-rest'].position)

/** Heights the weapons rest on. */
export const PROP_SURFACES = {
  lodgeTableTopY: tableRaw.anchors['top-surface'].surfaceY,
  sabrePlinthTopY: plinthRaw.anchors['top-surface'].surfaceY,
} as const

/** Bats are loaded for spec 11 H4 and not placed; their JSON is read so the tests prove it loads. */
export const BAT_NECK_PERCHED: Vec3 = at(batPerchedRaw.anchors.neck.position)
export const BAT_FLYING_ANCHORS = Object.keys((batFlyingRaw as { anchors?: object }).anchors ?? {})
