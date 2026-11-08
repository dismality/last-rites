// Hand-off between the wave director and the GraveBurst effect (same pattern as meleeRuntime).
export const graveBurstRuntime = {
  /** Ground positions where a grave just burst open; GraveBurst drains this each frame. */
  queue: [] as { x: number; z: number }[],
}
