// When the chapel bell last rang, for the belfry mesh to swing. Written by whatever rings the bell
// (the wave bell, the dusk bell), read each frame by ChapelBuilding. Not state any rule depends on.

export const bellRuntime: { ringAtMs: number | null } = { ringAtMs: null }

export function ringBell(nowMs: number = performance.now()): void {
  bellRuntime.ringAtMs = nowMs
}
