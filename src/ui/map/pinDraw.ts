// Canvas drawing for map pins, shared by the big map, the Journal map and the minimap.
// Each number has its own outline (circle, square, triangle) and carries its digit, so a pin is
// never told apart by colour alone. Stateless.

import { PIN_SHAPES, type PinSlot } from '../../game/systems/mapPins'

const EMBER = '#e8913a'
const INK = '#14110f'
const PAPER = 'rgba(216, 201, 163, 0.92)'

export interface PinGlyphOptions {
  /** Outer width in px. */
  size: number
  /** Ground the player has not explored: a "?" is drawn beside the pin. */
  unexplored?: boolean
  /** The pin the keyboard has selected: a dashed ring around it. */
  selected?: boolean
  /** Set when the pin is pinned to a border: a chevron points along this bearing (clockwise from up). */
  chevronAngle?: number | null
}

/** Path of the outline for a slot, centred on the origin with radius r. */
function outline(ctx: CanvasRenderingContext2D, slot: PinSlot, r: number): void {
  ctx.beginPath()
  switch (PIN_SHAPES[slot]) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      break
    case 'square':
      ctx.rect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8)
      break
    case 'triangle':
      ctx.moveTo(0, -r * 1.1)
      ctx.lineTo(r * 1.05, r * 0.85)
      ctx.lineTo(-r * 1.05, r * 0.85)
      ctx.closePath()
      break
  }
}

/** Draws one pin centred at (x, y). */
export function drawPinGlyph(
  ctx: CanvasRenderingContext2D,
  slot: PinSlot,
  x: number,
  y: number,
  o: PinGlyphOptions,
): void {
  const r = o.size / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.lineJoin = 'round'
  if (o.selected) {
    ctx.save()
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = INK
    ctx.lineWidth = Math.max(1.5, r * 0.18)
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  outline(ctx, slot, r)
  ctx.fillStyle = EMBER
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(1.5, r * 0.2)
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.font = `bold ${Math.round(r * 1.2)}px "Cormorant Garamond", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(slot), 0, slot === 3 ? r * 0.18 : 0)
  if (o.unexplored) {
    ctx.font = `bold ${Math.round(r * 1.1)}px "IM Fell English", serif`
    ctx.textAlign = 'left'
    ctx.lineWidth = 3
    ctx.strokeStyle = PAPER
    ctx.strokeText('?', r * 1.1, -r * 0.9)
    ctx.fillText('?', r * 1.1, -r * 0.9)
  }
  if (o.chevronAngle !== null && o.chevronAngle !== undefined) {
    ctx.rotate(o.chevronAngle)
    ctx.beginPath()
    ctx.moveTo(0, -r * 2.2)
    ctx.lineTo(r * 0.55, -r * 1.4)
    ctx.lineTo(-r * 0.55, -r * 1.4)
    ctx.closePath()
    ctx.fillStyle = EMBER
    ctx.fill()
    ctx.lineWidth = Math.max(1.2, r * 0.16)
    ctx.stroke()
  }
  ctx.restore()
}
