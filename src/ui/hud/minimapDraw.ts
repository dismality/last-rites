// Canvas drawing for the HUD minimap. It reuses the Journal map's pencil cells and landmark icons
// (mapDraw.drawCell / drawIcon) under a scale transform, so both maps look like one sketch.
// Stateless: the Minimap component owns timing and decides when to call it.

import { MAP_CELL_SIZE, MAP_PX, type Landmark } from '../../data/mapLandmarks'
import { MINIMAP } from '../../data/minimap'
import { worldToMap } from '../../game/systems/mapProject'
import { placeMarker, pxPerMetre, worldToMinimap, type MinimapGeometry } from '../../game/systems/minimapView'
import type { Cell } from '../../game/systems/mapReveal'
import { drawCell, drawIcon } from '../journal/mapDraw'
import { iconUrl } from '../../data/assets'
import { drawMarkImage, HUD_MARK_PX } from '../markImages'


const GRAPHITE = '#3a2f22'
const EMBER = '#e8913a'
const INK = '#14110f'
const PAPER = '#d8c9a3'
const PAPER_ALPHA = 0.6

export interface MinimapScene {
  geometry: MinimapGeometry
  player: { x: number; z: number; yaw: number }
  /** Explored cells inside the window, with ink progress 0..1. */
  cells: ReadonlyArray<{ cell: Cell; progress: number }>
  /** Already discovered landmarks (the caller filters by exploration and night-only). */
  landmarks: readonly Landmark[]
  /** World x, z of the current objective, when it has a place. */
  objective: { x: number; z: number } | null
  reducedMotion: boolean
}

export function drawMinimap(ctx: CanvasRenderingContext2D, scene: MinimapScene): void {
  const g = scene.geometry
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, g.sizePx, g.sizePx)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Cells: Journal map pixels -> minimap pixels. One map pixel is cellPx / 8 m.
  const k = pxPerMetre(g) / (MAP_PX.cellPx / MAP_CELL_SIZE)
  const [mx, mz] = worldToMap(scene.player.x, scene.player.z)
  const c = g.sizePx / 2
  ctx.setTransform(k, 0, 0, k, c - k * mx, c - k * mz)
  for (const { cell, progress } of scene.cells) {
    // Parchment under the pencil so explored ground reads against the dark, see-through frame;
    // unexplored cells get no paper and stay blank.
    const [cx, cz] = worldToMap(cell.cx * MAP_CELL_SIZE, cell.cz * MAP_CELL_SIZE)
    ctx.globalAlpha = PAPER_ALPHA * progress
    ctx.fillStyle = PAPER
    ctx.fillRect(cx, cz, MAP_PX.cellPx, MAP_PX.cellPx)
    ctx.globalAlpha = 1
    drawCell(ctx, cell, progress, scene.reducedMotion, MINIMAP.lineScale / k)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  for (const l of scene.landmarks) {
    const [x, y] = worldToMinimap(g, scene.player, l.position[0], l.position[2])
    const edge = MINIMAP.markerInsetPx
    if (x < edge || y < edge || x > g.sizePx - edge || y > g.sizePx - edge) continue
    ctx.save()
    ctx.translate(x, y)
    if (!drawMarkImage(ctx, iconUrl('mark-light', l.kind), HUD_MARK_PX)) {
      ctx.scale(MINIMAP.iconScale, MINIMAP.iconScale)
      drawIcon(ctx, l.kind, 0, 0)
    }
    ctx.restore()
  }

  if (scene.objective) drawObjective(ctx, scene)
  drawNorth(ctx, g)
  drawPlayer(ctx, g, scene.player.yaw)
}

/** Diamond for the objective; pinned to the border it also gets a chevron pointing toward it. */
function drawObjective(ctx: CanvasRenderingContext2D, scene: MinimapScene): void {
  if (!scene.objective) return
  const m = placeMarker(scene.geometry, scene.player, scene.objective, MINIMAP.markerInsetPx)
  ctx.save()
  ctx.translate(m.x, m.y)
  ctx.fillStyle = EMBER
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.5
  if (!drawMarkImage(ctx, iconUrl('mark-light', 'objective'), HUD_MARK_PX)) {
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(5.5, 0)
    ctx.lineTo(0, 7)
    ctx.lineTo(-5.5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  if (m.pinned) {
    // Chevron beyond the diamond, along the bearing to the target.
    ctx.rotate(m.angle)
    ctx.beginPath()
    ctx.moveTo(0, -15)
    ctx.lineTo(5, -9)
    ctx.lineTo(-5, -9)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** A small "N" at the top edge so north-up is stated, not assumed. */
function drawNorth(ctx: CanvasRenderingContext2D, g: MinimapGeometry): void {
  ctx.save()
  ctx.font = '16px "IM Fell English SC", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(216, 201, 163, 0.9)'
  ctx.strokeText('N', g.sizePx / 2, 2)
  ctx.fillStyle = GRAPHITE
  ctx.fillText('N', g.sizePx / 2, 2)
  ctx.restore()
}

/** Arrowhead with a notch: its tip shows the way the player faces (shape, not colour). */
function drawPlayer(ctx: CanvasRenderingContext2D, g: MinimapGeometry, yaw: number): void {
  ctx.save()
  ctx.translate(g.sizePx / 2, g.sizePx / 2)
  // Yaw 0 faces -Z (up the map) and positive yaw turns left, so the canvas rotation is -yaw.
  if (drawMarkImage(ctx, iconUrl('mark-light', 'player'), HUD_MARK_PX, -yaw)) {
    ctx.restore()
    return
  }
  ctx.rotate(-yaw)
  ctx.fillStyle = EMBER
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(7, 8)
  ctx.lineTo(0, 4)
  ctx.lineTo(-7, 8)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
