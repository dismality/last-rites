// What the keeper says aloud through Case 1, "Saved by the Bell" (playtest: every find must say
// what it is, with full names, what it means and what to check next). Pure data. The dates and
// names match `cases.ts` and `tombstones.ts`; `cases.test.ts` keeps them honest.

import type { BellPostId, LedgerFlagKind } from './cases'

export const CASE1_SAY = {
  /** Reading Elias's first page. */
  page: [
    'Elias says one of three graves is wrong, and that someone changed the parish ledger to hide it.',
    'I’ll read the stones of John Pell, Esther Ames and Tobias Hale, then check each one against the ledger in the hut.',
  ],
  /** Reading one of the three stones, before the ledger is checked. */
  stone: {
    pell: 'John Pell’s stone: died the 12th of March 1862, north row, plot 3, struck down by apoplexy. I’ll check that against his entry in the ledger.',
    ames: 'Esther Ames: died the 7th of November 1849, east row, plot 1, taken by fever. Now to see what the ledger says about her.',
    hale: 'Tobias Hale: died the 5th of November 1849, west row, plot 1, taken by cholera. I’ll compare it with his ledger entry.',
  } as Record<string, string>,
  /** Reading all three stones. */
  stonesDone: 'That’s all three stones. Now the ledger on the hut shelf.',
  /** Opening the ledger the first time. */
  ledgerOpen: [
    'Three names marked here: John Pell, Esther Ames and Tobias Hale.',
    'For each one I’ll check the stone, then mark whether the ledger agrees with it.',
  ],
  /** A ledger line marked right: what disagrees, in words. */
  ledgerRight: {
    pell: [
      'John Pell’s stone says he died on the 12th of March. The ledger says the 11th.',
      'The ledger has him dead a day before his own gravestone does.',
    ],
    ames: [
      'Esther Ames. Her stone says fever took her. The ledger says a fall.',
      'Someone wrote over the cause of death.',
    ],
    hale: [
      'Tobias Hale. His stone stands in the west row, plot 1. The ledger puts him in the east row, plot 4.',
      'Someone moved him, on paper.',
    ],
  } as Record<string, readonly string[]>,
  /** Marking "agrees" on a line that does not. */
  ledgerNotAgree: 'Look again. Something on this line doesn’t match the stone.',
  /** Marking the wrong kind of difference. */
  ledgerWrongKind: (kind: LedgerFlagKind): string =>
    kind === 'date'
      ? 'No, the dates agree. Something else is wrong.'
      : kind === 'plot'
        ? 'No, the plot agrees. Something else is wrong.'
        : 'No, the cause of death agrees. Something else is wrong.',
  /** All three lines marked. */
  ledgerSolved: [
    'So that’s three entries changed: John Pell, Esther Ames and Tobias Hale.',
    'The same fresh ink on each, and each one initialled J.V. in the margin. Someone rewrote these after the burials.',
    'Pell’s is the strangest. If the ledger has him dead a day early, was he buried before he was dead?',
    'This is strange. Every grave here has a safety bell. Let me check the bells on these three graves and see if anything’s wrong.',
  ],
  /** Pulling a bell cord. */
  bell: {
    'bell-ames': [
      'I pull Esther Ames’s cord. The bell rings clear. If she had woken, the watchman would have heard.',
    ],
    'bell-hale': ['Tobias Hale’s bell rings too. Nothing wrong with this one.'],
    'bell-pell': [
      'Nothing. John Pell’s cord hangs loose. It’s been cut clean, with a knife, not rotted through.',
      'His is the only bell here that could never ring.',
    ],
  } as Record<BellPostId, readonly string[]>,
  /** Pulling a cord already pulled. */
  bellAgain: {
    'bell-ames': 'Esther Ames’s bell still rings.',
    'bell-hale': 'Tobias Hale’s bell still rings.',
    'bell-pell': 'John Pell’s cord is still cut. Nothing rings.',
  } as Record<BellPostId, string>,
  /** All three cords pulled. */
  bellsDone:
    'Two bells ring and one doesn’t. I’ll write it down in my journal: which bell was cut?',
  /** The journal question answered wrong (by post). */
  cutWrong: {
    'bell-ames': 'No. Esther Ames’s bell rang when I pulled it.',
    'bell-hale': 'No. Tobias Hale’s bell rang when I pulled it.',
    'bell-pell': '',
  } as Record<BellPostId, string>,
  /** The journal question answered right: the tag, and who J.V. is. */
  cutRight: [
    'John Pell’s. Someone cut his cord, so no one would ever hear him ring.',
    'There’s a tag tied to the cut end: his death certificate, signed on the 11th of March by J. Vane, Undertaker.',
    'The 11th. The same false date as the ledger. He was signed dead a day before his stone says he died.',
    'J.V. The same initials as in the ledger margin. J. Vane, the undertaker: Josiah Vane.',
    'Someone must have wanted him buried. When night falls, I’ll name him at the chapel altar.',
  ],
  /** Said after `cutRight`: the wax seal on the tag, which Case 2's locker needs. */
  seal: 'Pressed into the tag is a red wax seal: a raven standing on a coffin, inside a shield. The Vane family crest. I’ll remember that.',
  /** The altar question answered right. */
  solved: [
    'Josiah Vane. He signed John Pell dead a day early, changed the ledger to cover it, and cut his bell cord so no one would hear him.',
    'Elias worked this out before me. That must be why he went missing.',
  ],
} as const

