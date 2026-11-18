// Bats that watch the player (spec 11 H4), mirrored from docs/game-design.md §14.4.
// Pure data: no logic, no side effects. Rules: game/systems/bats.ts and batPerches.ts.

export const BAT = {
  /** Perched bats per night, from stage 1; one per box, fewer if fewer boxes qualify. */
  perchedMin: 8,
  perchedMax: 12,
  /** A box qualifies as a perch when it is this tall (m), measured at its top face. */
  boxHeightMinM: 0.6,
  boxHeightMaxM: 1.6,
  /** Free height (m) a bat needs above a perch; a raised box starting lower (a cross shaft) rules it out. */
  headroomM: 0.8,
  /** `head` and `eyes` turn on Y toward the player inside this range (m). */
  watchRangeM: 14,
  /** Turn limit either side of rest (degrees). */
  maxYawDeg: 120,
  /** Ease time constant (s); back to rest within 2 s. */
  easeS: 0.4,
  restWithinS: 2,
  /** Take-off: player within this distance (m)... */
  takeoffM: 3,
  /** ...or a gunshot within this distance (m). */
  gunRangeM: 10,
  /** Wing flaps per second (`wing-left` and `wing-right` pivots). */
  flapsPerS: 8,
  /** Flight on a curved path away from the player (s), then a fade of at most fadeS. */
  flightS: 6,
  fadeS: 1,
  /** Return 120 s after removal, to a different free box. */
  returnS: 120,
  /** At most one chitter per this many seconds while a bat is perched. */
  chitterGapS: 20,
  /** Perched bats farther than this from the player (m) skip their update and redraw. */
  skipUpdateM: 40,
  /** Chances per second that an eligible perched bat chitters (the gap above still applies). */
  chitterRatePerS: 0.1,
  /** Wing swing either side of level (rad). */
  flapAmpRad: 0.7,
  /** Flee path: speed away from the player, a sideways sway, and the climb on take-off. */
  flee: {
    speedMps: 5,
    swayAmpM: 2.5,
    swayRadPerS: 0.9,
    climbM: 3.5,
    climbS: 2,
  },
  /** Optional belfry flock at the dusk bell: instanced, gone within maxS, no shake. */
  belfryFlock: {
    min: 15,
    max: 20,
    maxS: 10,
    /** Skipped when frames average over this many ms. */
    frameBudgetMs: 22,
    /** Frames in the rolling average that gates the flock. */
    frameWindow: 60,
    /** Instance buffer size; at least `max`. */
    capacity: 20,
    /** Leave the belfry at this speed (m/s) +- spread, climbing riseMps. */
    speedMps: 6,
    speedSpreadMps: 2,
    riseMps: 2.2,
    /** Bat size: wingspan (m) before the per-bat scale. */
    wingspanM: 0.4,
    /** Per-bat scale: sizeMin plus up to sizeSpread. */
    sizeMin: 0.8,
    sizeSpread: 0.4,
    /** Wing swing as a fraction of the distance from the body line. */
    flapAmp: 0.9,
    /** Fraction of the glow shown when Flashing lights is off (steady) versus its pulse range. */
    glowSteady: 0.5,
    glowPulseMin: 0.2,
    glowPulseMax: 1,
    glowPulseHz: 6,
  },
} as const
