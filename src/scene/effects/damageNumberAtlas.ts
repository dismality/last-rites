// Glyph atlas for floating damage numbers: digits plus "!" in one row of equal cells.
export const GLYPHS = '0123456789!'
export const CELL = 64

/** Index of a character in the atlas, or -1 when it is not drawn. */
export const glyphIndex = (ch: string): number => GLYPHS.indexOf(ch)

export function makeAtlasCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = CELL * GLYPHS.length
  canvas.height = CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${CELL * 0.8}px "Cormorant Garamond", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#000'
  ctx.shadowBlur = 4
  for (let i = 0; i < GLYPHS.length; i++) ctx.fillText(GLYPHS[i], i * CELL + CELL / 2, CELL / 2 + 2)
  return canvas
}
