import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  REVEAL_FADE_IN_S,
  REVEAL_HOLD_MAX_S,
  REVEAL_MAX_WAIT_S,
  emptyReveal,
  enqueueReveal,
  revealHoldSeconds,
  revealLook,
  revealTotalSeconds,
  tickReveal,
  type RevealItem,
} from './clueReveal'
import { CLUE_SPOTS } from '../../data/tombstones'
import { CLUES } from '../../data/clues'
import { CLUE_PICTURE_IDS, cluePicture, clueTitle } from '../../data/clueReveal'
import { clueModelUrl } from '../../data/assets'
import { createMysteryState, discoverClue, unreadClueCount } from './mystery'

const item = (key: string, queuedAt = 0, text = 'A short clue.'): RevealItem => ({ key, kind: 'clue', text, queuedAt })

describe('clue reveal timing (spec 09 task 11q)', () => {
  it('holds 3.5 s plus 45 ms a character, capped at 10 s', () => {
    expect(revealHoldSeconds('')).toBeCloseTo(3.5)
    expect(revealHoldSeconds('x'.repeat(20))).toBeCloseTo(4.4)
    expect(revealHoldSeconds('x'.repeat(1000))).toBe(REVEAL_HOLD_MAX_S)
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        if (a.length <= b.length) expect(revealHoldSeconds(a)).toBeLessThanOrEqual(revealHoldSeconds(b))
      }),
    )
  })
  it('fades in, holds at full, then fades out to nothing', () => {
    const t = 'Some clue text.'
    expect(revealLook(0, t, false).opacity).toBe(0)
    expect(revealLook(REVEAL_FADE_IN_S / 2, t, false).blur).toBeGreaterThan(0)
    expect(revealLook(REVEAL_FADE_IN_S + 1, t, false)).toEqual({ opacity: 1, offsetY: 0, blur: 0 })
    expect(revealLook(revealTotalSeconds(t), t, false).opacity).toBe(0)
  })
  it('uses a plain fade with reduced motion: no rise and no blur', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 20, noNaN: true }), (e) => {
        const look = revealLook(e, 'text', true)
        expect(look.offsetY).toBe(0)
        expect(look.blur).toBe(0)
      }),
    )
  })
})

describe('clue reveal queue', () => {
  it('shows two clues one after another, never together', () => {
    let s = enqueueReveal(enqueueReveal(emptyReveal(), item('a')), item('b'))
    s = tickReveal(s, 0, false)
    expect(s.current?.item.key).toBe('a')
    expect(s.queue.map((q) => q.key)).toEqual(['b'])
    s = tickReveal(s, 1000, false)
    expect(s.current?.item.key).toBe('a')
    const end = revealTotalSeconds('A short clue.') * 1000
    s = tickReveal(s, end + 1, false)
    expect(s.current?.item.key).toBe('b')
    expect(s.queue).toEqual([])
  })
  it('waits while a menu is open, then plays', () => {
    let s = enqueueReveal(emptyReveal(), item('a'))
    s = tickReveal(s, 5000, true)
    expect(s.current).toBeNull()
    s = tickReveal(s, 9000, false)
    expect(s.current?.item.key).toBe('a')
  })
  it('drops a clue that waited more than 30 s behind a menu', () => {
    let s = enqueueReveal(emptyReveal(), item('a', 0))
    s = tickReveal(s, (REVEAL_MAX_WAIT_S + 1) * 1000, true)
    s = tickReveal(s, (REVEAL_MAX_WAIT_S + 2) * 1000, false)
    expect(s.current).toBeNull()
    expect(s.queue).toEqual([])
  })
  it('shows the same clue only once', () => {
    let s = enqueueReveal(emptyReveal(), item('a'))
    s = tickReveal(s, 0, false)
    s = enqueueReveal(enqueueReveal(s, item('a')), item('a'))
    expect(s.queue).toEqual([])
  })
})

describe('clue pictures, models and titles', () => {
  // No node:fs in src (the app tsconfig has no node types): list the files through Vite's glob.
  const onDisk = new Set(
    Object.keys(import.meta.glob(['../../../public/assets/icons/clues/*.png', '../../../public/assets/models/props/clue-*.glb'])).map(
      (k) => k.replace('../../../public', ''),
    ),
  )
  it('every clue spot has a model and a picture', () => {
    for (const spot of CLUE_SPOTS) {
      expect(onDisk.has(clueModelUrl(spot.clueId)), spot.clueId).toBe(true)
      const pic = cluePicture(spot.clueId)
      expect(pic, spot.clueId).toBeDefined()
      expect(onDisk.has(pic!), spot.clueId).toBe(true)
    }
  })
  it('clues with no picture get no image, and every clue has a title', () => {
    for (const c of CLUES) {
      if (!CLUE_PICTURE_IDS.includes(c.id)) expect(cluePicture(c.id)).toBeUndefined()
      expect(clueTitle(c.id)).not.toBe('A clue')
    }
  })
})

describe('unread clues in the journal', () => {
  it('counts clues found since the tab was read', () => {
    let m = createMysteryState()
    m = discoverClue(discoverClue(m, 'clue-hut-boots'), 'clue-empty-graves')
    expect(unreadClueCount(m)).toBe(2)
    expect(unreadClueCount({ ...m, cluesRead: 2 })).toBe(0)
    // Saves from before 11q have no read count: everything counts as read.
    expect(unreadClueCount({ ...m, cluesRead: undefined })).toBe(0)
  })
})
