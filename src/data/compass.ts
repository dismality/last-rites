// Compass strip constants (design bible §11). Pure data.

export const COMPASS = {
  /** The strip shows heading ± this many degrees (180° total). */
  halfSpanDeg: 90,
  tickStepDeg: 15,
  /** Rough label metrics used only to decide when two markers overlap on the strip. */
  glyphWidthPx: 8,
  markerPadPx: 12,
} as const

export type CompassMarkerKind = 'objective' | 'chapel' | 'hut' | 'spawn' | 'merchant'

/** Every marker is a glyph plus text, never colour alone. */
export const COMPASS_MARKERS: Readonly<Record<CompassMarkerKind, { glyph: string; label: string }>> = {
  objective: { glyph: '◆', label: 'Objective' },
  chapel: { glyph: '✝', label: 'Chapel' },
  hut: { glyph: '⌂', label: 'Hut' },
  spawn: { glyph: '☠', label: 'Graves' },
  merchant: { glyph: '⚱', label: 'Silas' },
}

export const COMPASS_LETTERS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' } as const

/** Prefix on the objective label while it points at the hut door (spec 09, B6). */
export const COMPASS_DOOR_LABEL = 'Door'
