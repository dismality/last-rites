import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  CAPTIONS,
  CAPTION_MAX_VISIBLE,
  CAPTION_MIN_SECONDS,
  SILENT_CAPTION_EVENTS,
} from '../../data/captions'
import { SOUND_IDS } from '../../data/sounds'
import {
  EMPTY_CAPTION_QUEUE,
  expireCaptions,
  pushCaption,
  type CaptionQueue,
} from './captions'

const pushes = fc.array(
  fc.record({
    text: fc.string({ minLength: 1, maxLength: 12 }),
    duration: fc.double({ min: 0, max: 6, noNaN: true }),
    dt: fc.double({ min: 0, max: 3, noNaN: true }),
  }),
  { maxLength: 30 },
)

describe('captions queue', () => {
  it('fourth caption removes the oldest', () => {
    let q: CaptionQueue = EMPTY_CAPTION_QUEUE
    for (const t of ['a', 'b', 'c', 'd']) q = pushCaption(q, { text: t, duration: 3 }, 0, true)
    expect(q.items.map((c) => c.text)).toEqual(['b', 'c', 'd'])
  })

  it('a short caption stays 1.5 s', () => {
    const q = pushCaption(EMPTY_CAPTION_QUEUE, { text: 'x', duration: 0.2 }, 10, true)
    expect(expireCaptions(q, 11.4).items).toHaveLength(1)
    expect(expireCaptions(q, 11.5).items).toHaveLength(0)
  })

  it('produces nothing with Subtitles off, unless forced', () => {
    expect(pushCaption(EMPTY_CAPTION_QUEUE, { text: 'x', duration: 2 }, 0, false).items).toEqual([])
    expect(
      pushCaption(EMPTY_CAPTION_QUEUE, { text: 'x', duration: 2, force: true }, 0, false).items,
    ).toHaveLength(1)
  })

  // Property 33: Every important sound has a caption, and the queue obeys its limits
  // **Validates: Requirements 21.6, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 23.3**
  it('Property 33: every captioned sound has a caption, with a floor of 1.5 s', () => {
    for (const c of CAPTIONS) expect(c.minSeconds).toBeGreaterThanOrEqual(CAPTION_MIN_SECONDS)
    const events = new Set<string>(CAPTIONS.map((c) => c.event))
    for (const id of ['revolver-shot', 'shotgun-blast', 'dry-click', 'reload', 'board-break'])
      expect(events.has(id)).toBe(true)
    for (const e of events) expect([...SOUND_IDS, ...SILENT_CAPTION_EVENTS]).toContain(e)
  })

  it('Property 33: the queue never exceeds 3, drops only the oldest and only to make room', () => {
    fc.assert(
      fc.property(pushes, (ops) => {
        let q: CaptionQueue = EMPTY_CAPTION_QUEUE
        let now = 0
        for (const op of ops) {
          now += op.dt
          q = expireCaptions(q, now)
          const before = q.items
          q = pushCaption(q, op, now, true)
          expect(q.items.length).toBeLessThanOrEqual(CAPTION_MAX_VISIBLE)
          const last = q.items[q.items.length - 1]
          expect(last.text).toBe(op.text)
          expect(last.expiresAt - now).toBeGreaterThanOrEqual(
            Math.max(op.duration, CAPTION_MIN_SECONDS) - 1e-9,
          )
          const dropped = before.length + 1 - q.items.length
          expect(dropped).toBe(before.length >= CAPTION_MAX_VISIBLE ? 1 : 0)
          // Survivors keep their order and are the newest of the old lines.
          expect(q.items.slice(0, -1).map((c) => c.id)).toEqual(
            before.slice(dropped).map((c) => c.id),
          )
        }
      }),
    )
  })
})
