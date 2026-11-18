// Pure rules for info dot tooltips (spec 11 H5, design bible §14.5). The component in
// src/ui/theme/InfoDot.tsx only measures rectangles and renders; the rules live here so they
// can be tested in Node.

import { INFO_TIPS, type InfoTipKey } from '../../data/infoTips'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Gap kept between the dot and its tooltip, in px. */
const GAP = 8
/** Step of the fallback scan for a free spot, in px. */
const SCAN_STEP = 8

/**
 * Counts sentences: runs of text ended by ".", "!" or "?" (a trailing run without a mark counts
 * too). A dot between digits ("2.5") or inside an abbreviation-free word does not end one.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  const parts = trimmed.split(/(?<!\d)[.!?]+(?!\d)(?:\s+|$)/).filter((p) => p.trim() !== '')
  return parts.length
}

/** The tooltip text for a key, or null while info dots are off (nothing is rendered then). */
export function tipFor(key: InfoTipKey, showInfoDots: boolean): string | null {
  return showInfoDots ? INFO_TIPS[key] : null
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Top-left corner for a tooltip of `size` next to `anchor`. The result is always inside the
 * viewport (a tooltip larger than the viewport sits at 0,0) and, when any free spot exists,
 * clear of every `avoid` rect (health bar, oil gauge, controls hint panel).
 */
export function placeTooltip(anchor: Rect, size: Size, viewport: Size, avoid: readonly Rect[]): Point {
  const maxX = Math.max(0, viewport.width - size.width)
  const maxY = Math.max(0, viewport.height - size.height)
  const fit = (x: number, y: number): Point => ({ x: clamp(x, 0, maxX), y: clamp(y, 0, maxY) })
  const free = (p: Point): boolean => {
    const r = { x: p.x, y: p.y, width: size.width, height: size.height }
    return avoid.every((a) => !overlaps(r, a))
  }

  const centreX = anchor.x + anchor.width / 2 - size.width / 2
  const centreY = anchor.y + anchor.height / 2 - size.height / 2
  const candidates = [
    fit(centreX, anchor.y + anchor.height + GAP),
    fit(centreX, anchor.y - size.height - GAP),
    fit(anchor.x + anchor.width + GAP, centreY),
    fit(anchor.x - size.width - GAP, centreY),
  ]
  const direct = candidates.find(free)
  if (direct) return direct

  // Every side is blocked: take the free spot nearest the anchor.
  let best: Point | null = null
  let bestDist = Infinity
  for (let y = 0; y <= maxY + SCAN_STEP - 1; y += SCAN_STEP) {
    for (let x = 0; x <= maxX + SCAN_STEP - 1; x += SCAN_STEP) {
      const p = fit(x, y)
      if (!free(p)) continue
      const d = Math.hypot(p.x - centreX, p.y - centreY)
      if (d < bestDist) {
        best = p
        bestDist = d
      }
    }
  }
  return best ?? candidates[0]
}
