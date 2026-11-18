// Info dot tooltips (spec 11 H5, design bible §14.5). Each tip says how to play, not the story,
// in at most 2 sentences, from what the code does today: hint prices come from HINT_COSTS
// (data/cases.ts), the map key from the default bindings, the pin limit from PIN_LIMIT.
// The bible table lists the same keys; tests/designBibleSection12.test.ts checks them.

import { HINT_COSTS } from './cases'
import { DEFAULT_SETTINGS } from '../game/systems/settings'
import { PIN_LIMIT } from '../game/systems/mapPins'

/** Keys of the journal tabs (Journal.tsx TABS, plus Creatures from H2) and the HUD panels. */
export const INFO_TIP_KEYS = [
  'journal-pages',
  'journal-clues',
  'journal-case',
  'journal-closed',
  'journal-relics',
  'journal-contracts',
  'journal-map',
  'journal-creatures',
  'hud-case-board',
  'hud-clues',
  'hud-curse',
  'hud-hints',
  'hud-map',
  'hud-recipes',
  'hud-satchel',
  'hud-relics',
  'hud-oil',
  'hud-stamina',
  'hud-bestiary',
  'hud-coins',
] as const

export type InfoTipKey = (typeof INFO_TIP_KEYS)[number]

/** "KeyM" becomes "M". */
function keyName(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '')
}

const MAP_KEY = keyName(DEFAULT_SETTINGS.bindings.Map)
const JOURNAL_KEY = keyName(DEFAULT_SETTINGS.bindings.Journal)
const SATCHEL_KEY = DEFAULT_SETTINGS.bindings.Satchel
const [HINT_1, HINT_2, HINT_3] = HINT_COSTS

export const INFO_TIPS: Readonly<Record<InfoTipKey, string>> = {
  'journal-pages': 'Pages you have found are readable here, and a page waits unread until its stage. Pick a page in the list to read it.',
  'journal-clues': 'Every clue you find is kept here. Open one to read it again, then link it on the case board.',
  'journal-case': 'Drag from one clue card to another, or select a card and press Enter on a second, to test a link. The altar answers only at night, and only after enough correct links.',
  'journal-closed': 'Cases you have solved are filed here with their answers.',
  'journal-relics': 'The five relics of the rite show here once you hold them. All five are needed to finish the rite in stage 3.',
  'journal-contracts': 'Contracts are side jobs from Silas that pay Grave Coins when done. Each one shows its progress and reward.',
  'journal-map': `Click the map to drop a pin, up to ${PIN_LIMIT}. Click a pin to take it off again.`,
  'journal-creatures': 'Creatures you have seen are sketched here with what works against them. Unseen ones stay blank.',
  'hud-case-board': 'Link two clue cards that belong together, by drag or by selecting both. A solid string with a check mark is a true link and lowers the Curse meter.',
  'hud-clues': `Clues you find are listed here and kept in the journal (${JOURNAL_KEY}). Unread ones are marked.`,
  'hud-curse': 'The meter falls by one for each correct clue link. The night ends when the case is answered right at the altar.',
  'hud-hints': `Hints cost ${HINT_1}, then ${HINT_2}, then ${HINT_3} Grave Coins, and come in that order. A refused hint never takes coins.`,
  'hud-map': `Press ${MAP_KEY} for the big map and place pins to mark places. Walk within 2 m of a pin to clear it.`,
  'hud-recipes': 'Recipes you know are crafted at the workbench in the keeper\u2019s hut. A recipe shows what you are still missing.',
  'hud-satchel': `Press ${SATCHEL_KEY} to open the satchel. It holds 12 stacks, and key items, relics and coins take no slot.`,
  'hud-relics': 'Relics are found in the cemetery and kept without a slot. Place all five on the altar in the right order to finish the rite.',
  'hud-oil': 'The flame shows lantern oil. Craft a Lantern Refill when it runs low, since less oil means a smaller light and more scares.',
  'hud-stamina': 'Sprinting drains stamina, and it comes back after a short rest. Kicks and dodges cost stamina too.',
  'hud-bestiary': 'The Bestiary lists each creature after you have seen it. Read what works before the next night.',
  'hud-coins': 'Grave Coins drop from zombies. Spend them at the dawn merchant, at the vending machine in the hut, or on case hints.',
}
