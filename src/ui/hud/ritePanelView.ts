// Words for the rite panel (spec 10 task 4.5, Req 17). Pure: the panel shows what the stores say.
// The rite is fictional and treated seriously, so the wording stays plain and quiet.

import { RELIC_MAP } from '../../data/relics'
import type { PlaceOutcome } from '../../game/state/riteStore'
import { clock, LINK_MESSAGE } from './altarPanelView'

export const CRANE_WAITS_MESSAGE = 'All five stand in their places. The rite waits for Father Crane to be put to rest.'
export const ALL_PLACED_MESSAGE = 'All five stand in their places.'
export const SOUR_NOTE_MESSAGE =
  'A sour note. The relic stays in your satchel, the dead are rising and the altar is silent for 30 seconds.'

/** Words for what just happened after a placement. */
export function placeMessage(out: PlaceOutcome, relicName: string): string {
  switch (out.kind) {
    case 'placed':
      return out.complete ? 'The last relic rests. The rite is done.' : `${relicName} is laid on the altar.`
    case 'wrong':
      return out.verdict.kind === 'needs-link' ? LINK_MESSAGE : SOUR_NOTE_MESSAGE
    case 'locked':
      return `The altar is silent: ${clock(out.secondsLeft)}`
    case 'refused':
      return 'That place is already taken.'
    case 'not-held':
      return 'You do not hold that relic.'
    case 'unavailable':
      return 'The rite is not for now.'
  }
}

/** The relic's display name. */
export const relicName = (id: keyof typeof RELIC_MAP): string => RELIC_MAP[id].name
