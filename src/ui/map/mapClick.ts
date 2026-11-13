// What a left-click on a map does, shared by the big map and the Journal map tab.
// The caller supplies the projection pair of its own drawing, so the click lands on the point
// that is drawn under the cursor.
import { usePinStore } from '../../game/state/pinStore'
import { PIN_HIT_PX, nearestWithin, type Pin } from '../../game/systems/mapPins'

export interface ClickLandmark {
  name: string
  x: number
  z: number
}

export interface MapClickGeometry {
  /** World metres to the map's own pixels (the same unit as the click). */
  project: (x: number, z: number) => [number, number]
  /** Map pixels back to world metres. */
  unproject: (px: number, py: number) => [number, number]
  /** Hit radius in the map's pixels. */
  hitPx?: number
}

export type MapClickResult = { kind: 'removed'; pin: Pin } | { kind: 'placed'; pin: Pin }

/** The pin under a point, if any. */
export function pinAt(pins: readonly Pin[], g: MapClickGeometry, px: number, py: number): Pin | undefined {
  return nearestWithin(pins, (p) => g.project(p.x, p.z), px, py, g.hitPx ?? PIN_HIT_PX)
}

/** Click on a pin removes it; click on a landmark pins it by name; otherwise pins the ground. */
export function clickMap(
  g: MapClickGeometry,
  landmarks: readonly ClickLandmark[],
  px: number,
  py: number,
): MapClickResult {
  const store = usePinStore.getState()
  const hit = pinAt(store.pins, g, px, py)
  if (hit) {
    store.remove(hit.slot)
    return { kind: 'removed', pin: hit }
  }
  const lm = nearestWithin(landmarks, (l) => g.project(l.x, l.z), px, py, g.hitPx ?? PIN_HIT_PX)
  const [wx, wz] = lm ? [lm.x, lm.z] : g.unproject(px, py)
  store.place({ x: wx, z: wz, name: lm?.name })
  const pins = usePinStore.getState().pins
  return { kind: 'placed', pin: pins[pins.length - 1] }
}
