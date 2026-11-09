// Pure zone-card rules: per-zone cooldown and fade opacity (Req 7.1, 7.3, 7.5, 10.8).

import { ZONE_CARD_COOLDOWN_S, ZONE_CARD_FADE_S, ZONE_CARD_SHOW_S } from '../../data/zoneCards'
import type { ZoneId } from '../../data/zones'

export type ZoneLastShown = Readonly<Partial<Record<ZoneId, number>>>

/**
 * A card shows on a zone change when that zone's last card is at least the cooldown old.
 * Only `recordZoneCard` moves `last`, so re-entering inside the cooldown cannot restart it.
 */
export const shouldShowZoneCard = (
  prev: ZoneId | null,
  next: ZoneId,
  now: number,
  last: ZoneLastShown,
): boolean => {
  if (prev === next) return false
  const shownAt = last[next]
  return shownAt === undefined || now - shownAt >= ZONE_CARD_COOLDOWN_S
}

export const recordZoneCard = (last: ZoneLastShown, zone: ZoneId, now: number): ZoneLastShown => ({
  ...last,
  [zone]: now,
})

/** Fade in, hold, fade out inside the show window; reduced motion switches instantly. */
export const cardOpacity = (elapsedS: number, reducedMotion: boolean): number => {
  if (!(elapsedS >= 0 && elapsedS < ZONE_CARD_SHOW_S)) return 0
  if (reducedMotion) return 1
  const fadeIn = elapsedS / ZONE_CARD_FADE_S
  const fadeOut = (ZONE_CARD_SHOW_S - elapsedS) / ZONE_CARD_FADE_S
  return Math.max(0, Math.min(1, fadeIn, fadeOut))
}
