// Redraw gate for the HUD minimap. Pure: the caller passes the clock and what it sees this frame.
// A redraw happens only when something visible changed, and never more often than maxHz.

export interface RedrawSample {
  x: number
  z: number
  /** Camera yaw in radians. */
  yaw: number
  /** Identity of the explored-cells object; a new object means a cell was revealed (or reset). */
  mapRef: object
  /** Anything that changes what is pinned or drawn besides position: objective place, landmark set. */
  contentKey: string
  /** Newly revealed cells are still inking in, so the picture changes without any input. */
  animating: boolean
}

export interface RedrawTuning {
  moveM: number
  turnDeg: number
  maxHz: number
}

export interface RedrawState {
  at: number
  sample: RedrawSample
}

const angleDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % (2 * Math.PI)
  return d > Math.PI ? 2 * Math.PI - d : d
}

/** True when the picture would look different from the one drawn last (ignoring the time limit). */
export function isDirty(prev: RedrawSample | null, cur: RedrawSample, t: RedrawTuning): boolean {
  if (prev === null) return true
  if (prev.mapRef !== cur.mapRef || prev.contentKey !== cur.contentKey) return true
  if (cur.animating) return true
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) > t.moveM) return true
  return angleDiff(cur.yaw, prev.yaw) > (t.turnDeg * Math.PI) / 180
}

/**
 * Decide whether to redraw now. `prev` is the state returned by the last redraw (null before the
 * first). The returned state is the new "last drawn" only when `redraw` is true, so a change that is
 * held back by the rate limit is still pending on the next frame. Position and yaw are compared
 * with the last drawn sample, not the last frame, so slow drift still triggers a redraw.
 */
export function stepRedraw(
  prev: RedrawState | null,
  now: number,
  cur: RedrawSample,
  t: RedrawTuning,
): { redraw: boolean; state: RedrawState | null } {
  if (prev !== null && now - prev.at < 1000 / t.maxHz) return { redraw: false, state: prev }
  if (!isDirty(prev?.sample ?? null, cur, t)) return { redraw: false, state: prev }
  return { redraw: true, state: { at: now, sample: cur } }
}
