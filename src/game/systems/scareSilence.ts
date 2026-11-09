import { MUSIC } from '../../data/music'

export interface SilenceState {
  /** Announced major-scare beats that have not fired yet (simClock times). */
  pending: readonly { id: string; beatAt: number }[]
  /** Silence is held until this time after the later fired beat. */
  holdUntil: number
}

export const emptySilence: SilenceState = { pending: [], holdUntil: -Infinity }

/** Announces a beat. Re-announcing an id moves its beat. */
export const announce = (s: SilenceState, id: string, beatAt: number): SilenceState => ({
  ...s,
  pending: [...s.pending.filter((p) => p.id !== id), { id, beatAt }],
})

/** The beat happened: drop it and hold silence until 2 s after it (a later beat extends, never shortens). */
export const fired = (s: SilenceState, id: string, now: number): SilenceState => ({
  pending: s.pending.filter((p) => p.id !== id),
  holdUntil: Math.max(s.holdUntil, now + MUSIC.silenceAfterBeatS),
})

/**
 * Pending beats keep the silence on even when overdue (a menu can hold a beat), so music never
 * returns before the scare really fires.
 */
export const isSilent = (s: SilenceState, now: number): boolean =>
  s.pending.some((p) => p.beatAt - now <= MUSIC.silenceBeforeBeatS) || now < s.holdUntil

/** Same window: from the announcement to 2 s after the beat. */
export const majorScareActive = isSilent

export const beatImminent = (s: SilenceState): boolean => s.pending.length > 0
