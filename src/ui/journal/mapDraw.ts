// Canvas 2D drawing for the journal map: pencil-hatched cells, sketched landmark
// icons and the quill marker. Stateless; the Map component owns animation timing.

import { MAP_EXTENT, MAP_PX, type Landmark, type LandmarkKind } from '../../data/mapLandmarks'
import { iconUrl, type MarkId } from '../../data/assets'
import { createRng } from '../../game/rng'
import { drawMarkImage } from '../markImages'
import { drawPinGlyph } from '../map/pinDraw'
import type { Pin } from '../../game/systems/mapPins'
import { clampToMap, worldToMap } from '../../game/systems/mapProject'
import type { Cell } from '../../game/systems/mapReveal'

const CELL_PX = MAP_PX.cellPx
const MARGIN_PX = MAP_PX.marginPx
export const MAP_COLS = MAP_EXTENT.maxCx - MAP_EXTENT.minCx + 1
export const MAP_ROWS = MAP_EXTENT.maxCz - MAP_EXTENT.minCz + 1
export const MAP_WIDTH = MAP_COLS * CELL_PX + MARGIN_PX * 2
export const MAP_HEIGHT = MAP_ROWS * CELL_PX + MARGIN_PX * 2

const GRAPHITE = '#3a2f22'
const WASH = 'rgba(120, 100, 66, 0.16)'
const STROKES_PER_CELL = 7

/** World metres to canvas pixels. */
export function toPx(x: number, z: number): [number, number] {
  return worldToMap(x, z)
}

export interface MapScene {
  /** Explored cells with ink progress 0..1. */
  cells: ReadonlyArray<{ cell: Cell; progress: number }>
  landmarks: readonly Landmark[]
  player: { x: number; z: number; yaw: number }
  /** Current objective; the marker is drawn only when it has a world position. */
  objective?: { position?: readonly [number, number, number]; marker?: string; main: string } | null
  /** Marks with no landmark entry (hut, merchant, wave graves); the caller decides which show. */
  extraMarks?: readonly ExtraMark[]
  /** Pins, drawn above the landmarks and under the objective and the quill. */
  pins?: ReadonlyArray<{ pin: Pin; unexplored: boolean; selected?: boolean }>
  /** Fade cells in instead of drawing strokes (prefers-reduced-motion). */
  reducedMotion: boolean
}

export interface ExtraMark {
  id: MarkId
  x: number
  z: number
  /** Text glyph drawn if the image is not ready. */
  glyph: string
}

/** Journal marks are drawn at this size (px on the 1:1 map sheet). */
export const MAP_MARK_PX = 24

/** The old text glyph, kept as the fallback for marks that have no sketched icon. */
function drawGlyphMark(ctx: CanvasRenderingContext2D, glyph: string): void {
  ctx.fillStyle = GRAPHITE
  ctx.font = '18px "IM Fell English", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 0)
}

/** A landmark as its dark mark image, or the sketched icon while that loads or if it fails. */
export function drawLandmark(ctx: CanvasRenderingContext2D, kind: LandmarkKind, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  const drawn = drawMarkImage(ctx, iconUrl('mark-dark', kind), MAP_MARK_PX)
  ctx.restore()
  if (!drawn) drawIcon(ctx, kind, x, y)
}

export function drawMap(ctx: CanvasRenderingContext2D, scene: MapScene): void {
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const { cell, progress } of scene.cells) drawCell(ctx, cell, progress, scene.reducedMotion)
  for (const l of scene.landmarks) {
    const [px, pz] = toPx(l.position[0], l.position[2])
    drawLandmark(ctx, l.kind, px, pz)
  }
  for (const m of scene.extraMarks ?? []) {
    const [px, pz] = toPx(m.x, m.z)
    ctx.save()
    ctx.translate(px, pz)
    if (!drawMarkImage(ctx, iconUrl('mark-dark', m.id), MAP_MARK_PX)) drawGlyphMark(ctx, m.glyph)
    ctx.restore()
  }
  for (const { pin, unexplored, selected } of scene.pins ?? []) {
    const [px, pz] = toPx(pin.x, pin.z)
    drawPinGlyph(ctx, pin.slot, px, pz, { size: PIN_SHEET_PX, unexplored, selected })
  }
  drawObjective(ctx, scene.objective)
  drawQuill(ctx, scene.player)
}

/** Pin size on the 1:1 Journal sheet (px). */
export const PIN_SHEET_PX = 22

/** Where markers go and where they are clamped; the Journal sheet by default, the big map's screen otherwise. */
export interface MapProjection {
  toPx: (x: number, z: number) => [number, number]
  clamp: (px: number, py: number) => [number, number]
  /** Right edge of the drawing area, so a label flips left near it. */
  width: number
}

const SHEET_PROJECTION: MapProjection = { toPx, clamp: clampToMap, width: MAP_WIDTH }

/** Diamond glyph plus a 16 px text label, clamped to the map edge so it is never lost. */
export function drawObjective(
  ctx: CanvasRenderingContext2D,
  o: MapScene['objective'],
  proj: MapProjection = SHEET_PROJECTION,
): void {
  if (!o?.position) return
  const [x, y] = proj.clamp(...proj.toPx(o.position[0], o.position[2]))
  const label = o.marker ?? o.main
  ctx.save()
  ctx.translate(x, y)
  const withImage = drawMarkImage(ctx, iconUrl('mark-dark', 'objective'), MAP_MARK_PX)
  ctx.translate(-x, -y)
  ctx.fillStyle = '#e8913a'
  ctx.strokeStyle = '#14110f'
  ctx.lineWidth = 1.6
  if (!withImage) {
    ctx.beginPath()
    ctx.moveTo(x, y - 9)
    ctx.lineTo(x + 7, y)
    ctx.lineTo(x, y + 9)
    ctx.lineTo(x - 7, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.font = '16px "IM Fell English", serif'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(label).width
  // Flip the label left of the glyph near the right edge so it stays on the sheet.
  const gap = withImage ? MAP_MARK_PX / 2 + 4 : 12
  const flip = x + gap + w > proj.width
  ctx.textAlign = flip ? 'right' : 'left'
  const tx = flip ? x - gap : x + gap
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(216, 201, 163, 0.9)'
  ctx.strokeText(label, tx, y)
  ctx.fillStyle = GRAPHITE
  ctx.fillText(label, tx, y)
  ctx.restore()
}

/** A wobbly pencil outline plus diagonal hatching; the jitter is seeded per cell so it never shimmers. */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  progress: number,
  reduced: boolean,
  /** Multiplies the pencil line widths; the HUD minimap draws the same cells scaled down. */
  lineScale = 1,
): void {
  if (progress <= 0) return
  const x = MARGIN_PX + (cell.cx - MAP_EXTENT.minCx) * CELL_PX
  const y = MARGIN_PX + (cell.cz - MAP_EXTENT.minCz) * CELL_PX
  const rng = createRng(cell.cx * 7919 + cell.cz * 104729 + 1891)
  const j = () => (rng() - 0.5) * 2.2

  ctx.save()
  ctx.globalAlpha = reduced ? progress : 1
  ctx.fillStyle = WASH
  ctx.fillRect(x, y, CELL_PX, CELL_PX)
  ctx.strokeStyle = GRAPHITE
  ctx.lineWidth = lineScale

  // Hatching: draw only the first `progress` share of strokes while animating.
  const visible = reduced ? STROKES_PER_CELL : Math.ceil(STROKES_PER_CELL * progress)
  ctx.globalAlpha *= 0.55
  for (let i = 0; i < visible; i++) {
    const t = ((i + 0.5) / STROKES_PER_CELL) * CELL_PX * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.min(t, CELL_PX) + j(), y + Math.max(0, t - CELL_PX) + j())
    ctx.lineTo(x + Math.max(0, t - CELL_PX) + j(), y + Math.min(t, CELL_PX) + j())
    ctx.stroke()
  }

  // Outline: four sides drawn in order, so it appears to be sketched around the cell.
  ctx.globalAlpha = reduced ? progress : 1
  ctx.lineWidth = 1.4 * lineScale
  const corners: Array<[number, number]> = [
    [x, y],
    [x + CELL_PX, y],
    [x + CELL_PX, y + CELL_PX],
    [x, y + CELL_PX],
    [x, y],
  ]
  const sides = reduced ? 4 : Math.floor(progress * 4 + 0.001)
  ctx.beginPath()
  ctx.moveTo(corners[0][0] + j(), corners[0][1] + j())
  for (let s = 1; s <= sides; s++) ctx.lineTo(corners[s][0] + j(), corners[s][1] + j())
  ctx.stroke()
  ctx.restore()
}

/** Sketched icons: each kind has its own silhouette so colour is never the only cue. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: LandmarkKind, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(216, 201, 163, 0.9)'
  ctx.strokeStyle = GRAPHITE
  ctx.lineWidth = 1.6
  ctx.beginPath()
  switch (kind) {
    case 'workbench': // table top on two legs
      ctx.rect(-7, -4, 14, 4)
      ctx.moveTo(-5, 0)
      ctx.lineTo(-5, 6)
      ctx.moveTo(5, 0)
      ctx.lineTo(5, 6)
      break
    case 'chapel': // gabled house with a cross on top
      ctx.moveTo(-6, 6)
      ctx.lineTo(-6, -2)
      ctx.lineTo(0, -7)
      ctx.lineTo(6, -2)
      ctx.lineTo(6, 6)
      ctx.closePath()
      ctx.moveTo(0, -7)
      ctx.lineTo(0, -12)
      ctx.moveTo(-2.5, -10)
      ctx.lineTo(2.5, -10)
      break
    case 'gate': // arch with bars
      ctx.moveTo(-6, 7)
      ctx.lineTo(-6, -1)
      ctx.arc(0, -1, 6, Math.PI, 0)
      ctx.lineTo(6, 7)
      ctx.moveTo(-2, 7)
      ctx.lineTo(-2, -5)
      ctx.moveTo(2, 7)
      ctx.lineTo(2, -5)
      break
    case 'relic': // diamond with a mark
      ctx.moveTo(0, -8)
      ctx.lineTo(6, 0)
      ctx.lineTo(0, 8)
      ctx.lineTo(-6, 0)
      ctx.closePath()
      ctx.moveTo(-2.5, 0)
      ctx.lineTo(2.5, 0)
      break
  }
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** Quill: a feather-shaped pointer aimed along the player's heading. */
export function drawQuill(
  ctx: CanvasRenderingContext2D,
  p: { x: number; z: number; yaw: number },
  proj: MapProjection = SHEET_PROJECTION,
): void {
  const [x, y] = proj.clamp(...proj.toPx(p.x, p.z))
  // Camera yaw 0 looks toward -Z (up the map); positive yaw turns left (counter-clockwise).
  const angle = -p.yaw
  ctx.save()
  ctx.translate(x, y)
  // The player mark image keeps the quill's facing: rotated by the same angle.
  if (drawMarkImage(ctx, iconUrl('mark-dark', 'player'), MAP_MARK_PX, angle)) {
    ctx.restore()
    return
  }
  ctx.rotate(angle)
  ctx.fillStyle = '#e8913a'
  ctx.strokeStyle = '#14110f'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(0, -11) // nib
  ctx.quadraticCurveTo(6, -2, 3, 7)
  ctx.lineTo(0, 4)
  ctx.lineTo(-3, 7)
  ctx.quadraticCurveTo(-6, -2, 0, -11)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // Quill shaft
  ctx.beginPath()
  ctx.moveTo(0, -6)
  ctx.lineTo(0, 11)
  ctx.stroke()
  ctx.restore()
}
