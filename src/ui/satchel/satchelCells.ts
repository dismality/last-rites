/** Number of satchel cells to draw: base slots plus Deep Pockets, as reported by the modifiers. */
export function satchelCellCount(satchelSlots: number): number {
  return Math.max(0, Math.floor(satchelSlots))
}

/** Clamp a focus index to the cells that exist. */
export function clampCellIndex(idx: number, cellCount: number): number {
  return Math.max(0, Math.min(cellCount - 1, idx))
}
