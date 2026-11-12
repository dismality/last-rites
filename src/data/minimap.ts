// HUD minimap numbers (spec 09 task 11e). The explored cells, landmarks and ink timing come from
// the Journal map data (mapLandmarks.ts); only the view and the redraw budget live here.

export const MINIMAP = {
  /** Metres from the player to each edge of the window, so the window spans 80 m. */
  radiusM: 40,
  /** Canvas backing size in pixels; CSS scales it down on small viewports. */
  canvasPx: 192,
  /** Keeps pinned markers fully inside the frame. */
  markerInsetPx: 16,
  /** A redraw is considered only after the player moved this far (m), ... */
  redrawMoveM: 0.25,
  /** ... turned this much (degrees), a cell was revealed, or the objective changed. */
  redrawTurnDeg: 3,
  /** Never more than this many redraws a second. */
  maxRedrawHz: 15,
  /** Pencil line widths are scaled so 28 px map cells still read at the minimap's scale. */
  lineScale: 1.5,
  /** Landmark icons are drawn at this fraction of their Journal size. */
  iconScale: 0.8,
} as const
