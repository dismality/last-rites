// Zone name cards (design bible §11). Pure data.

import type { ZoneId } from './zones'

export const ZONE_CARDS: Readonly<Record<ZoneId, { name: string; line: string }>> = {
  grounds: { name: "Keeper's Hut and Grounds", line: 'Crooked stones and dead oaks.' },
  'mausoleum-row': {
    name: 'Mausoleum Row',
    line: 'The great families sleep here. Not all of them.',
  },
  chapel: { name: 'Hollowmere Chapel', line: 'Candle smoke and old prayers.' },
  catacombs: { name: 'The Catacombs', line: 'They were not dead when they came down.' },
}

/** Total time a card is visible; the fades sit inside this window. */
export const ZONE_CARD_SHOW_S = 2.5
/** Per-zone wait so walking along a boundary doesn't repeat the card. */
export const ZONE_CARD_COOLDOWN_S = 30
/** Inside the 150–300 ms UI transition band. */
export const ZONE_CARD_FADE_S = 0.25
