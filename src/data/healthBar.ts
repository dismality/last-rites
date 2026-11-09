// Health bar size and timings (design bible §11). The numbers live here so the pure
// display function and the component read one source.

import { LOW_HEALTH_THRESHOLD } from './balance'

export const HEALTH_BAR = {
  /** Size at 1080p. */
  widthPx: 260,
  heightPx: 18,
  /** The pale recent-damage chunk stays put this long before it drains. */
  holdS: 0.15,
  drainS: 0.6,
  /** Healing eases the fill up instead of jumping, so a heal reads as a heal. */
  easeS: 0.4,
  /** Parchment-white frame flash on a hit (Flashing lights On). */
  flashS: 0.12,
  /** Thickened frame on a hit (Flashing lights Off): a shape cue instead of a flash. */
  thickenS: 0.3,
  pulseCycleS: 1.2,
  /** Below this HP the "Low" tag shows. Shared with the heartbeat and desaturation. */
  lowBelow: LOW_HEALTH_THRESHOLD,
} as const
