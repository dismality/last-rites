// First-person hands: grip table and clip names (design bible §14.7, spec 11 H7).

export type GripClass = 'pistol' | 'haft' | 'long'

/** Weapons that are held in the viewmodel (thrown flasks and bombs use the throw clip instead). */
export type GripWeaponId =
  | 'revolver'
  | 'shotgun'
  | 'rusty-shovel'
  | 'sharpened-shovel'
  | 'wood-axe'
  | 'bone-club'
  | 'silver-sabre'

export const GRIP_TABLE: Readonly<Record<GripWeaponId, GripClass>> = {
  revolver: 'pistol',
  shotgun: 'long',
  'rusty-shovel': 'haft',
  'sharpened-shovel': 'haft',
  'wood-axe': 'haft',
  'bone-club': 'haft',
  'silver-sabre': 'haft',
}

/** Clip names inside `viewmodel/hands.glb`. */
export const HANDS_CLIPS = {
  gripPistol: 'Grip-Pistol',
  gripHaft: 'Grip-Haft',
  gripLong: 'Grip-Long',
  lanternHold: 'Lantern-Hold',
  throw: 'Throw',
  reloadRevolver: 'Reload-Revolver',
  reloadShotgun: 'Reload-Shotgun',
  swingLight: 'Swing-Light',
  swingHeavy: 'Swing-Heavy',
} as const

export type HandsClip = (typeof HANDS_CLIPS)[keyof typeof HANDS_CLIPS]

/** Grip class to its clip. */
export const GRIP_CLIPS: Readonly<Record<GripClass, HandsClip>> = {
  pistol: HANDS_CLIPS.gripPistol,
  haft: HANDS_CLIPS.gripHaft,
  long: HANDS_CLIPS.gripLong,
}

/** Mesh names inside `viewmodel/lantern.glb`. */
export const LANTERN_MESHES = { glass: 'glass', flame: 'flame' } as const

export const VIEWMODEL_TIMING = {
  /** Grip switch completes within this many seconds of changing weapon. */
  gripBlendS: 0.3,
  /** Lantern sway lag, seconds (±0.02). */
  swayLagS: 0.08,
  swayLagToleranceS: 0.02,
  /** Sprint drop range in metres. */
  sprintDropM: [0.05, 0.15],
  /** Lantern back in the hand within this many seconds after switching away from the shotgun. */
  beltReturnS: 0.5,
  /** Lantern caught again within this many seconds after a throw or heavy swing. */
  strapCatchS: 0.6,
  /** A thrown flask or bomb keeps the lantern on its strap this long before the catch starts (s). */
  throwActionS: 0.45,
  /** Shotgun belt light points forward and this many degrees down (min, max). */
  beltLightDownDeg: [10, 20],
} as const
