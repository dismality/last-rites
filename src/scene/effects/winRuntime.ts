// Hand-off for the win walk-out (spec 10 task 6), same pattern as endingCameraRuntime: WinCutscene
// writes it each frame, the sky, the gate cut in the fence and the walk-out captions read it.
import { Plane, Vector3 } from 'three'
import { useSettingsStore } from '../../game/state/settingsStore'
import { WIN_GATE, type WinSequenceDef } from '../../data/winCutscene'
import { winSequenceFor } from '../../game/systems/winSequence'

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** The walk for this player: the steady one under reduced motion or with Camera shake off (Req 23.5). */
export function currentWinSequence(): WinSequenceDef {
  return winSequenceFor(reducedMotion(), useSettingsStore.getState().cameraShake)
}

export const winRuntime = {
  /** The walk-out is playing or its last pose is held behind the card. */
  active: false,
  /** Seconds into the walk. */
  time: 0,
  /** 0..1, how far the sun has risen (and the fog lifted). */
  sun: 0,
  /** Dev hook only: hold the walk at this second (the gate-shot screenshots). Null runs it. */
  holdAt: null as number | null,
}

/**
 * Four world-space planes whose intersection is cut out of the graveyard's iron fence and stone
 * footing (material.clipIntersection), so the walk can pass through the south fence where the gate
 * stands. Shut, the cut is empty. The planes live on the materials from the first frame, so opening
 * the gate only moves uniforms and never recompiles a shader.
 */
export const WIN_GATE_CLIP: Plane[] = [
  new Plane(new Vector3(-1, 0, 0), 0),
  new Plane(new Vector3(1, 0, 0), 0),
  new Plane(new Vector3(0, 0, -1), 0),
  new Plane(new Vector3(0, 0, 1), 0),
]

/** Opens or closes the cut in the fence. A point is clipped when it is behind all four planes. */
export function setGateCut(open: boolean): void {
  const { x, z, halfWidth, halfDepth } = WIN_GATE
  const [west, east, north, south] = WIN_GATE_CLIP
  // Clipped where x > constant (west) ... shut, the west plane clips nothing (x > 1e6).
  west.constant = open ? x - halfWidth : 1e6
  east.constant = -(x + halfWidth)
  north.constant = z - halfDepth
  south.constant = -(z + halfDepth)
}
setGateCut(false)

export function resetWinRuntime(): void {
  winRuntime.active = false
  winRuntime.time = 0
  winRuntime.sun = 0
  winRuntime.holdAt = null
  setGateCut(false)
}
