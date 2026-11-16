import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CASE_1_BELLS, type BellPostId } from '../../data/cases'
import {
  BELL_FACETS,
  cutQuestionOpen,
  cyclePost,
  isPostExamined,
  NO_FACETS_READ,
  POST_IDS,
  readFacet,
  turnFacet,
} from './bellsMinigame'
import { bellPosts } from './caseMinigames'

describe('turnFacet and cyclePost', () => {
  it('arrows wrap round the three facets and other keys do nothing', () => {
    expect(turnFacet(0, 'ArrowLeft')).toBe(2)
    expect(turnFacet(2, 'ArrowRight')).toBe(0)
    expect(turnFacet(1, 'Enter')).toBe(1)
  })
  it('Tab and Shift+Tab visit every post', () => {
    expect(cyclePost(2, false)).toBe(0)
    expect(cyclePost(0, true)).toBe(2)
  })
  it('turning there and back is the identity', () => {
    // Feature: 10-curse-stages, Requirement 13.5 keyboard-only turning
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 }), (i) => turnFacet(turnFacet(i, 'ArrowRight'), 'ArrowLeft') === i),
      { numRuns: 100 },
    )
  })
})

describe('reading facets', () => {
  it('a post is examined only after bell, rope and tag are all read', () => {
    let read = NO_FACETS_READ
    for (const f of BELL_FACETS.slice(0, 2)) read = readFacet(read, 'bell-pell', f)
    expect(isPostExamined(read['bell-pell'])).toBe(false)
    read = readFacet(read, 'bell-pell', 'tag')
    expect(isPostExamined(read['bell-pell'])).toBe(true)
    expect(isPostExamined(read['bell-hale'])).toBe(false)
  })
  it('reading twice changes nothing', () => {
    const once = readFacet(NO_FACETS_READ, 'bell-ames', 'rope')
    expect(readFacet(once, 'bell-ames', 'rope')).toBe(once)
  })
})

describe('the cut-bell question and its verdict (Req 13.2, 13.4)', () => {
  const cut = CASE_1_BELLS.find((p) => p.condition === 'rope-cut')!.id
  it('opens only when all three posts are examined', () => {
    expect(cutQuestionOpen(POST_IDS.slice(0, 2))).toBe(false)
    expect(cutQuestionOpen(POST_IDS)).toBe(true)
  })
  it('only the cut post solves it; every other post is rejected with a message', () => {
    fc.assert(
      fc.property(fc.constantFrom<BellPostId>(...POST_IDS), (answer) => {
        const v = bellPosts({ examined: POST_IDS, cutAnswer: answer })
        return answer === cut ? v.ok : !v.ok && v.message !== undefined
      }),
      { numRuns: 100 },
    )
  })
})
