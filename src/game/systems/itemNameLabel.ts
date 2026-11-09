// Opacity curve of the item-name label. Pure: the caller passes elapsed real milliseconds.
import { ITEM_NAME_LABEL } from '../../data/itemLabel'

/** 1 during the hold, a linear fade to 0 afterwards, 0 once finished. */
export function itemNameOpacity(elapsedMs: number, reducedMotion = false): number {
  if (elapsedMs < 0) return 0
  const { holdMs, fadeMs, reducedFadeMs } = ITEM_NAME_LABEL
  if (elapsedMs <= holdMs) return 1
  const fade = reducedMotion ? reducedFadeMs : fadeMs
  return Math.max(0, 1 - (elapsedMs - holdMs) / fade)
}

/** True once the name has fully faded and no frame loop is needed. */
export function itemNameFinished(elapsedMs: number, reducedMotion = false): boolean {
  return itemNameOpacity(elapsedMs, reducedMotion) <= 0
}
