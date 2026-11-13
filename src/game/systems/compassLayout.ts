// Compass label layout (design bible §11). Pure TS: decides which row each label sits on and how
// far it shifts so two labels never draw over each other ("19 m" on top of "Hut").

export interface LabelBox {
  id: string
  /** Strip position of the label's anchor, px from the left of the marker layer. */
  centerPx: number
  /** Measured (or estimated) width of the whole label: mark image, glyph and text. */
  widthPx: number
  pinned: 'left' | 'right' | null
  /** May be hidden instead of shifted when both rows are taken (the spawn skulls). */
  droppable?: boolean
}

export interface LabelPlacement {
  id: string
  /** 0 = bottom row, 1 = second row above it. */
  lane: 0 | 1
  /** Sideways shift in px, applied on top of the anchor. */
  shiftPx: number
  hidden: boolean
}

/** Breathing room kept between two labels on the same row. */
export const LABEL_GAP_PX = 6

type Span = readonly [number, number]

/** Pinned labels sit inside the strip against their edge; others centre on the anchor. */
export const spanOf = (b: LabelBox): Span =>
  b.pinned === 'left'
    ? [b.centerPx, b.centerPx + b.widthPx]
    : b.pinned === 'right'
      ? [b.centerPx - b.widthPx, b.centerPx]
      : [b.centerPx - b.widthPx / 2, b.centerPx + b.widthPx / 2]

const clashes = (s: Span, row: readonly Span[], gap: number): boolean =>
  row.some(([a, b]) => s[0] < b + gap && s[1] + gap > a)

/**
 * Places labels in priority order. A label that fits the bottom row stays there; otherwise it
 * takes the second row; if that is also taken it slides along the second row to the nearest free
 * spot. Droppable labels are hidden rather than slid. The result never has two visible labels
 * overlapping on one row, and the two rows are stacked, so none overlaps across rows either.
 */
export function layoutCompassLabels(boxes: readonly LabelBox[], gap: number = LABEL_GAP_PX): LabelPlacement[] {
  const rows: [Span[], Span[]] = [[], []]
  const out: LabelPlacement[] = []
  for (const box of boxes) {
    const span = spanOf(box)
    if (!clashes(span, rows[0], gap)) {
      rows[0].push(span)
      out.push({ id: box.id, lane: 0, shiftPx: 0, hidden: false })
      continue
    }
    if (!clashes(span, rows[1], gap)) {
      rows[1].push(span)
      out.push({ id: box.id, lane: 1, shiftPx: 0, hidden: false })
      continue
    }
    if (box.droppable) {
      out.push({ id: box.id, lane: 1, shiftPx: 0, hidden: true })
      continue
    }
    // Candidate shifts put this label flush against either side of each placed label.
    const candidates = rows[1].flatMap(([a, b]) => [b + gap - span[0], a - gap - span[1]])
    candidates.sort((p, q) => Math.abs(p) - Math.abs(q))
    const shift =
      candidates.find((c) => !clashes([span[0] + c, span[1] + c], rows[1], gap)) ?? 0
    rows[1].push([span[0] + shift, span[1] + shift])
    out.push({ id: box.id, lane: 1, shiftPx: shift, hidden: false })
  }
  return out
}
