// Pure view rules for minigame 1b, the bell posts (spec 10 task 3.5, Req 13.1, 13.2, 13.5, 13.6).
// The verdict itself is `bellPosts` in caseMinigames.ts; this file only decides how the examine
// view turns, which details the player has read and when the "Which bell was cut?" question opens.
// No React, three.js or Howler imports.

import { CASE_1_BELLS, type BellPostDef, type BellPostId } from '../../data/cases'

/** The three things to look at on a post, in the order the view turns through them. */
export const BELL_FACETS = ['bell', 'rope', 'tag'] as const
export type BellFacet = (typeof BELL_FACETS)[number]

export const FACET_LABEL: Record<BellFacet, string> = { bell: 'Turn the bell', rope: 'Inspect the rope', tag: 'Read the tag' }

/** Facets read so far, per post. */
export type FacetsRead = Readonly<Record<BellPostId, readonly BellFacet[]>>

export const NO_FACETS_READ: FacetsRead = { 'bell-pell': [], 'bell-hale': [], 'bell-ames': [] }

export const POST_IDS: readonly BellPostId[] = CASE_1_BELLS.map((p) => p.id)

/** Arrows turn the view round the post: left and up go back, right and down go on; it wraps. */
export function turnFacet(current: number, code: string): number {
  const n = BELL_FACETS.length
  if (code === 'ArrowLeft' || code === 'ArrowUp') return (current + n - 1) % n
  if (code === 'ArrowRight' || code === 'ArrowDown') return (current + 1) % n
  return current
}

/** Tab moves to the next post, Shift+Tab to the one before; it wraps. */
export function cyclePost(index: number, shift: boolean, count = POST_IDS.length): number {
  return (index + (shift ? count - 1 : 1)) % count
}

/** Marks one facet read; reading twice changes nothing. */
export function readFacet(read: FacetsRead, post: BellPostId, facet: BellFacet): FacetsRead {
  if (read[post].includes(facet)) return read
  return { ...read, [post]: [...read[post], facet] }
}

/** A post counts as examined once its bell, rope and tag have all been read. */
export function isPostExamined(read: readonly BellFacet[]): boolean {
  return BELL_FACETS.every((f) => read.includes(f))
}

/** What the facet shows, from the post's own text. */
export function facetText(post: BellPostDef, facet: BellFacet): string {
  return post[facet]
}

/**
 * The part of a post that is wrong, marked in the notes so the comparison reads at a glance: a cut
 * cord, or a tag signed before the death.
 */
export function facetIsOdd(post: BellPostDef, facet: BellFacet): boolean {
  if (facet === 'rope') return post.condition === 'rope-cut'
  if (facet === 'bell') return false
  return post.tagClueId !== undefined || /^No certificate/.test(post.tag)
}

/** The question opens only when every post has been examined (so all three clues can be pinned). */
export function cutQuestionOpen(examined: readonly BellPostId[]): boolean {
  return POST_IDS.every((id) => examined.includes(id))
}

/** Clue-card titles shown once the bells are solved, so the player sees what was pinned. */
export const PINNED_NOTE = 'Pinned to the case board: the cut cord, the two bells that ring and the signed tag.'

/** View yaw of a facet in radians: the post model turns a third of a turn per facet. */
export function facetYaw(index: number): number {
  return (index * 2 * Math.PI) / BELL_FACETS.length
}
