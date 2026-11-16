// Keeper's hunch (spec 10, E11, Req 24.1-24.2; design bible §11): after 2 minutes of day play
// without a new clue, the lantern flame on the HUD leans toward the nearest unfound clue.

export const KEEPER_HUNCH = {
  /** Seconds of day play without a new clue before the flame leans. */
  afterS: 120,
  /** The flame's lean at full strength, in degrees of skew about its base. */
  maxLeanDeg: 22,
  /** A clue nearer than this (metres) needs no lean: the player is already on it. */
  arriveM: 2,
  /** The gentle breathing sway on top of the lean, when head bob is on and motion is not reduced. */
  swayDeg: 3,
  swayHz: 0.6,
  /** Seconds the lean takes to follow a turn (an ease, never a jump), when motion is not reduced. */
  easeS: 0.6,
} as const
