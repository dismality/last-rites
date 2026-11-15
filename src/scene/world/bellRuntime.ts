// When the chapel bell last rang, for the belfry mesh to swing. Written by whatever rings the bell
// (the wave bell, the dusk bell), read each frame by ChapelBuilding. Not state any rule depends on.
// `meshAngle` is the angle ChapelBuilding last gave the bell mesh (null until the mesh is found),
// so a browser test can see the real mesh swing.

export const bellRuntime: { ringAtMs: number | null; meshAngle: number | null } = {
  ringAtMs: null,
  meshAngle: null,
}

export function ringBell(nowMs: number = performance.now()): void {
  bellRuntime.ringAtMs = nowMs
}
