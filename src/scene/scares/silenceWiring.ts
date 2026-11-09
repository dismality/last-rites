// Pure glue between the scare director's cues and the music silence schedule (scareSilence.ts).
// Kept free of React and stores so it runs in Node tests.
import { SCARE_EVENT_MAP } from '../../data/scares'
import { announce, fired, type SilenceState } from '../../game/systems/scareSilence'
import type { ScareCue } from '../../game/systems/scareDirector'

/**
 * Telegraph of a major scare: schedule the music silence for its beat. The director clock and
 * simClock differ, so only the remaining distance to the beat (never negative) is carried over.
 */
export function announceMajor(
  silence: SilenceState,
  cue: ScareCue,
  queue: readonly ScareCue[],
  directorTime: number,
  simNow: number,
): SilenceState {
  if (SCARE_EVENT_MAP[cue.eventId].tier !== 'major') return silence
  const beat = queue.find((c) => c.eventId === cue.eventId && c.phase === 'beat')
  const beatAt = beat ? beat.at : directorTime + SCARE_EVENT_MAP[cue.eventId].telegraph.lead
  return announce(silence, cue.eventId, simNow + Math.max(0, beatAt - directorTime))
}

/** The beat really played (a menu-held beat never reaches here, so its silence stays on). */
export function fireMajor(silence: SilenceState, cue: ScareCue, simNow: number): SilenceState {
  if (SCARE_EVENT_MAP[cue.eventId].tier !== 'major') return silence
  return fired(silence, cue.eventId, simNow)
}
