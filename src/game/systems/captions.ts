// Caption queue (Req 22.2-22.5). Pure: the Subtitles overlay feeds it `subtitleShown` events and
// reads the visible lines back, so the limits are testable without React.

import { CAPTION_MAX_VISIBLE, CAPTION_MIN_SECONDS } from '../../data/captions'

export interface QueuedCaption {
  id: number
  text: string
  /** Time (seconds, same clock as `now`) at which the line leaves the screen. */
  expiresAt: number
}

export interface CaptionQueue {
  items: readonly QueuedCaption[]
  nextId: number
}

export interface CaptionInput {
  text: string
  /** Requested seconds on screen; raised to the 1.5 s floor. */
  duration: number
  /** Scares at intensity Off still describe themselves; the caption is the only cue. */
  force?: boolean
}

export const EMPTY_CAPTION_QUEUE: CaptionQueue = { items: [], nextId: 0 }

export function captionSeconds(duration: number): number {
  const d = Number.isFinite(duration) ? duration : 0
  return Math.max(d, CAPTION_MIN_SECONDS)
}

/** Adds a caption. Nothing is produced when Subtitles is Off (unless forced). */
export function pushCaption(
  queue: CaptionQueue,
  input: CaptionInput,
  now: number,
  subtitlesOn: boolean,
): CaptionQueue {
  if (!subtitlesOn && !input.force) return queue
  // Drop the oldest only, and only when the new line needs the room.
  const kept =
    queue.items.length >= CAPTION_MAX_VISIBLE
      ? queue.items.slice(queue.items.length - CAPTION_MAX_VISIBLE + 1)
      : queue.items
  const item: QueuedCaption = {
    id: queue.nextId,
    text: input.text,
    expiresAt: now + captionSeconds(input.duration),
  }
  return { items: [...kept, item], nextId: queue.nextId + 1 }
}

/** Removes lines whose time is up. */
export function expireCaptions(queue: CaptionQueue, now: number): CaptionQueue {
  const items = queue.items.filter((c) => c.expiresAt > now)
  return items.length === queue.items.length ? queue : { ...queue, items }
}
