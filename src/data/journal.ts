// Journal pages — mirrored from docs/game-design.md §1.
// Written in Elias Thorne's voice: a tired, careful man who writes down what he cannot say aloud.
// Pure data: no logic, no side effects.

import type { PageNumber, RecipeId } from '../game/types'

export interface JournalPage {
  id: PageNumber
  /** Id of the FixedSpawn (src/data/zones.ts) where this page is found. */
  location: string
  title: string
  text: string
  /** Recipe taught when the page is read. */
  unlocks?: RecipeId
}

export const JOURNAL_PAGES: readonly JournalPage[] = [
  {
    id: 1,
    location: 'fx-page-1',
    title: 'The first week',
    text:
      'Third night at Hollowmere and I have stopped pretending it is the foxes. ' +
      'The graves along the north row were not dug from above. The soil is pushed up and outward, ' +
      'as though something had been trying to leave. I checked the dates against the parish ledger ' +
      'and they do not agree. Someone has been tidying the truth. I will keep the lantern lit.',
  },
  {
    id: 2,
    location: 'fx-page-2',
    title: 'The Marsh plot',
    text:
      'Found this beneath the Marsh family stone, wrapped in oilcloth. The ledger records ' +
      'thirty-one burials in a single week of 1849, and not one death certificate among them. ' +
      'Thirty-one graves, and I have dug beside half of them. They are empty. ' +
      'Whoever was laid here did not stay, or was never laid here at all.',
  },
  {
    id: 3,
    location: 'fx-page-3',
    title: "Crane's confession",
    text:
      'The Crane crypt gave up a fragment in the priest\u2019s own hand. "They were not dead. ' +
      'God forgive me, they were not yet dead, and I could not bear the fever to spread." ' +
      'He sealed them below the chapel and wrote them into the ledger as buried. ' +
      'At the foot of the page is a ring of salt and a note: grave salt and holy water, ' +
      'drawn as a circle, and nothing foul will cross it. I have copied it out.',
    unlocks: 'r-salt-circle',
  },
  {
    id: 4,
    location: 'fx-page-4',
    title: 'The ossuary wall',
    text:
      'Scratches on every stone, low down, where a seated man could reach. Names, hundreds of ' +
      'small marks, and the same names again and again. Beside the sealed door, five relics are ' +
      'listed for the Rite of Rest: the rosary, the clapper, the locket, the shroud, the heart. ' +
      'Crane meant to lay them on the altar and finish what guilt began. ' +
      'He died with the words half said. I mean to say the rest.',
  },
  {
    id: 5,
    location: 'fx-page-5',
    title: 'Last entry',
    text:
      'The rite did not take. I did not have all five, and I did not hold the words long enough. ' +
      'I can hear them in the chapel walls now, and I can hear myself among them. ' +
      'Finish it, whoever you are. Do not let me out.',
  },
]

export const JOURNAL_PAGE_MAP: Readonly<Record<PageNumber, JournalPage>> = Object.fromEntries(
  JOURNAL_PAGES.map((p) => [p.id, p]),
) as Record<PageNumber, JournalPage>

/** The page an item id stands for ("journal-page-3" -> page 3), or null for any other item. */
export function journalPageForItem(itemId: string): JournalPage | null {
  const m = /^journal-page-([1-5])$/.exec(itemId)
  return m ? JOURNAL_PAGE_MAP[Number(m[1]) as PageNumber] : null
}
