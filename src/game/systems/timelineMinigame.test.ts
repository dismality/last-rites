import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  CASE_3_CARD_SHELF,
  CASE_3_CRYPT_PROPS,
  CASE_3_EVIDENCE,
  CASE_3_EVIDENCE_SPOTS,
  CASE_3_TIMELINE_ORDER,
  type EvidenceCardId,
} from '../../data/cases'
import { GRAVEYARD_COLLIDERS } from '../../data/graveyardColliders'
import { FIXED_SPAWNS } from '../../data/zones'
import { evidenceTimeline } from './caseMinigames'
import { freshCaseSave, mergeRetry, revealedIds, sanitizeCaseSave } from './caseSave'
import { availableFixedSpawns, createSpawnWorld } from './spawns'
import {
  cardAt,
  heldCards,
  moveCard,
  replayBeats,
  syncTimeline,
  timelineKey,
  timelineReady,
} from './timelineMinigame'

const ids = CASE_3_EVIDENCE.map((e) => e.id)
const cardIds = fc.constantFrom<EvidenceCardId>(...ids)

describe('card data (Req 16.1)', () => {
  it('the shelf order holds each card once and is not the right order', () => {
    expect([...CASE_3_CARD_SHELF].sort()).toEqual([...ids].sort())
    expect(CASE_3_CARD_SHELF).not.toEqual(CASE_3_TIMELINE_ORDER)
  })

  it('every card but the boots has a place in the world', () => {
    expect(Object.keys(CASE_3_EVIDENCE_SPOTS).sort()).toEqual(ids.filter((i) => i !== 'dry-boots').sort())
  })

  it('the Row props stand inside the avenue and clear every collision box', () => {
    const row = [CASE_3_CRYPT_PROPS.slate, CASE_3_CRYPT_PROPS.body, CASE_3_EVIDENCE_SPOTS['spilled-oil'].position]
    for (const [x, , z] of row) {
      expect(x, 'inside the 3.5 m avenue').toBeGreaterThan(-21.75)
      expect(x).toBeLessThan(-18.25)
      expect(z).toBeGreaterThan(CASE_3_CRYPT_PROPS.doorFaceZ)
      for (const b of GRAVEYARD_COLLIDERS) {
        const inside = Math.abs(x - b.center[0]) < b.half[0] && Math.abs(z - b.center[2]) < b.half[2]
        expect(inside, `${x},${z} inside a box at ${b.center}`).toBe(false)
      }
    }
  })
})

describe('held cards and the slate order', () => {
  it('counts the dry boots through their hut clue', () => {
    expect(heldCards([], false)).toEqual([])
    expect(heldCards([], true)).toEqual(['dry-boots'])
    expect(heldCards(['cart-ruts'], true)).toEqual(['dry-boots', 'cart-ruts'])
  })

  it('puts newly found cards in front and keeps the player arrangement', () => {
    expect(syncTimeline(['cart-ruts', 'dry-boots'], ['dry-boots', 'cart-ruts', 'hearse-pin'])).toEqual([
      'hearse-pin',
      'cart-ruts',
      'dry-boots',
    ])
  })

  it('Property: sync keeps exactly the held cards, once each', () => {
    // Validates: Requirements 16.1
    fc.assert(
      fc.property(fc.array(cardIds, { maxLength: 8 }), fc.uniqueArray(cardIds), (order, held) => {
        const out = syncTimeline(order, held)
        expect([...out].sort()).toEqual([...held].sort())
      }),
    )
  })

  it('Property: moving a card keeps the same cards', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(ids, { minLength: 1 }), fc.nat(7), fc.nat(7), (order, a, b) => {
        const out = moveCard(order, a, b)
        expect([...out].sort()).toEqual([...order].sort())
        if (a < order.length && b < order.length) expect(out[b]).toBe(order[a])
      }),
    )
  })
})

describe('keyboard (Req 16.5)', () => {
  const start = { cursor: 0, lifted: false, order: [...CASE_3_CARD_SHELF] }

  it('arrows choose a card and stop at the ends', () => {
    expect(timelineKey(start, 'ArrowLeft').cursor).toBe(0)
    expect(timelineKey(start, 'ArrowRight').cursor).toBe(1)
    expect(timelineKey({ ...start, cursor: 5 }, 'ArrowRight').cursor).toBe(5)
  })

  it('Space lifts, arrows then carry the card, Space sets it down', () => {
    const up = timelineKey(start, 'Space')
    expect(up.lifted).toBe(true)
    const moved = timelineKey(up, 'ArrowRight')
    expect(moved.cursor).toBe(1)
    expect(moved.order[1]).toBe(start.order[0])
    expect(moved.order[0]).toBe(start.order[1])
    expect(timelineKey(moved, 'Space').lifted).toBe(false)
  })

  it('Enter asks to confirm and changes nothing else', () => {
    const r = timelineKey(start, 'Enter')
    expect(r.confirm).toBe(true)
    expect(r.order).toEqual(start.order)
  })

  it('carrying cards with the keyboard can reach the right order and be accepted', () => {
    let s = { cursor: 0, lifted: false, order: [...CASE_3_CARD_SHELF] }
    // Selection sort with lift / move / drop: each wanted card is carried left to its place.
    CASE_3_TIMELINE_ORDER.forEach((want, place) => {
      s = { ...s, cursor: s.order.indexOf(want), lifted: false }
      s = timelineKey(s, 'Space')
      while (s.cursor > place) s = timelineKey(s, 'ArrowLeft')
      s = timelineKey(s, 'Space')
    })
    expect(evidenceTimeline(s.order)).toEqual({ ok: true })
  })
})

describe('judging (Req 16.2, 16.4)', () => {
  it('needs all six cards before the order can be judged', () => {
    expect(timelineReady(CASE_3_TIMELINE_ORDER)).toBe(true)
    expect(timelineReady(CASE_3_TIMELINE_ORDER.slice(0, 5))).toBe(false)
  })

  it('names the card sitting at the first wrong place', () => {
    const swapped = [...CASE_3_TIMELINE_ORDER]
    ;[swapped[4], swapped[5]] = [swapped[5], swapped[4]]
    const v = evidenceTimeline(swapped)
    expect(v.ok).toBe(false)
    expect(cardAt(swapped, v.firstWrong)).toBe('nail-marks')
    expect(cardAt(swapped, undefined)).toBeNull()
    expect(cardAt(swapped, 9)).toBeNull()
  })

  it('replays the night in the right order, one beat per card', () => {
    const beats = replayBeats()
    expect(beats).toHaveLength(6)
    expect(beats[0]).toContain('midnight')
  })
})

describe('the crypt reward (Req 16.2, 16.3)', () => {
  const key = (revealed: Parameters<typeof availableFixedSpawns>[3]) =>
    availableFixedSpawns(createSpawnWorld(), 'day', FIXED_SPAWNS, revealed).find((s) => s.item === 'iron-ossuary-key')

  it('the Iron Ossuary Key lies in the crypt only once minigame 3b is solved', () => {
    expect(key([])).toBeUndefined()
    expect(key(['3a'])).toBeUndefined()
    expect(key(['3b'])).toBeDefined()
  })

  it('a solved 3b in the Case_Store reveals it', () => {
    const save = freshCaseSave()
    expect(revealedIds(save)).not.toContain('3b')
    save.cases['sealed-catacombs'].minigames.push('3b')
    expect(revealedIds(save)).toContain('3b')
  })
})

describe('save and retry', () => {
  it('sanitises junk and keeps card ids through JSON', () => {
    const save = freshCaseSave()
    save.cases['sealed-catacombs'].evidenceFound = ['cart-ruts', 'hearse-pin']
    save.cases['sealed-catacombs'].timeline = ['hearse-pin', 'cart-ruts']
    const back = sanitizeCaseSave(JSON.parse(JSON.stringify(save)))
    expect(back.cases['sealed-catacombs'].evidenceFound).toEqual(['cart-ruts', 'hearse-pin'])
    expect(back.cases['sealed-catacombs'].timeline).toEqual(['hearse-pin', 'cart-ruts'])
    const junk = JSON.parse(JSON.stringify(save))
    junk.cases['sealed-catacombs'].evidenceFound = ['cart-ruts', 'cart-ruts', 'bogus', 4]
    expect(sanitizeCaseSave(junk).cases['sealed-catacombs'].evidenceFound).toEqual(['cart-ruts'])
  })

  it('a retry never un-finds a card', () => {
    const snap = freshCaseSave()
    const now = freshCaseSave()
    now.cases['sealed-catacombs'].evidenceFound = ['spilled-oil']
    now.cases['sealed-catacombs'].timeline = ['spilled-oil']
    const merged = mergeRetry(snap, now).cases['sealed-catacombs']
    expect(merged.evidenceFound).toEqual(['spilled-oil'])
    expect(merged.timeline).toEqual(['spilled-oil'])
  })
})
