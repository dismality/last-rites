// Mark images for the canvas maps. Each file loads once and is cached. Until it has loaded, or if
// it fails, callers draw the sketched glyph they always had, so a missing file never blanks a mark.

/** HUD marks (compass and minimap) are drawn at 20 px. */
export const HUD_MARK_PX = 20

export type MarkStatus = 'loading' | 'loaded' | 'error'

/** The fallback rule in one place: only a fully loaded image replaces the glyph. */
export function markDrawChoice(status: MarkStatus): 'image' | 'glyph' {
  return status === 'loaded' ? 'image' : 'glyph'
}

interface Entry {
  img: HTMLImageElement
  status: MarkStatus
}

const cache = new Map<string, Entry>()
const listeners = new Set<() => void>()
let version = 0

/** Bumps each time an image finishes loading, so gated redraws can notice. */
export function marksVersion(): number {
  return version
}

/** Called when any mark finishes loading; returns the unsubscribe. */
export function onMarksLoaded(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function entryFor(url: string): Entry | null {
  const hit = cache.get(url)
  if (hit) return hit
  if (typeof Image === 'undefined') return null
  const img = new Image()
  const entry: Entry = { img, status: 'loading' }
  img.onload = () => {
    entry.status = 'loaded'
    version++
    listeners.forEach((cb) => cb())
  }
  img.onerror = () => {
    entry.status = 'error'
  }
  img.src = url
  cache.set(url, entry)
  return entry
}

/** The image when it is ready to draw, otherwise null (still loading, failed, or no DOM). */
export function loadedMark(url: string): HTMLImageElement | null {
  const e = entryFor(url)
  return e && markDrawChoice(e.status) === 'image' ? e.img : null
}

/**
 * Draws a mark centred on the origin of the current transform, `sizePx` square and unsmoothed.
 * Returns false (drawing nothing) when the caller should draw its glyph instead.
 */
export function drawMarkImage(
  ctx: CanvasRenderingContext2D,
  url: string,
  sizePx: number,
  rotation = 0,
): boolean {
  const img = loadedMark(url)
  if (!img) return false
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (rotation !== 0) ctx.rotate(rotation)
  ctx.drawImage(img, -sizePx / 2, -sizePx / 2, sizePx, sizePx)
  ctx.restore()
  return true
}
