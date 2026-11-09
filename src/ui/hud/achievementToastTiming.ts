import { TOAST } from '../../data/achievements'

/** Toasts are information the subtitle may not carry, so they never drop below this (Req 8.5). */
export const MIN_TOAST_S = 3

/** Seconds a toast stays up. Independent of the Subtitles setting by design. */
export function toastDurationS(): number {
  return Math.max(TOAST.showS, MIN_TOAST_S)
}

/** Opacity for a toast `age` seconds after it appeared: fade in, hold, fade out. */
export function toastOpacity(age: number, durationS: number = TOAST.showS, fadeS: number = TOAST.fadeS): number {
  if (age <= 0 || age >= durationS) return 0
  if (fadeS <= 0) return 1
  const fadeIn = Math.min(1, age / fadeS)
  const fadeOut = Math.min(1, (durationS - age) / fadeS)
  return Math.max(0, Math.min(fadeIn, fadeOut))
}

export function toastExpired(age: number, durationS: number = TOAST.showS): boolean {
  return age >= durationS
}

/** Splits unlocks (in unlock order) into the shown ones and the waiting ones. */
export function splitToasts<T>(items: readonly T[], max: number = TOAST.maxVisible): { visible: T[]; queued: T[] } {
  return { visible: items.slice(0, max), queued: items.slice(max) }
}
