// Closed-case pages (spec 10 task 2.1, Req 7.1 and 7.5). Each page is 3 to 5 sentences of real
// history, told with respect and no gore. They appear in the journal once a case is solved.
// Pure data. Shown one sentence per paragraph, so keep every entry a single sentence.

import type { CaseId } from './stages'

export const CLOSED_CASE_PAGES: Readonly<Record<CaseId, readonly string[]>> = {
  // Case 1 is the keeper's own write-up: it writes itself across the page when the case is solved.
  'saved-by-the-bell': [
    'The ledger says John Pell died on the 11th of March. His own stone says the 12th.',
    'His bell cord was cut clean, and his was the only one: the bells of Esther Ames and Tobias Hale both ring.',
    'His death certificate was signed on the 11th by J. Vane, the undertaker, while he was still alive.',
    'Josiah Vane signed John Pell dead a day early, rewrote the ledger to match, and cut the cord so no one would hear him ring.',
    'He changed the entries for Esther Ames and Tobias Hale too, to hide Pell among them.',
    'What this proves: Elias found it first. The Vanes bury people who know too much.',
  ],
  'resurrection-men': [
    'Anatomy schools needed bodies, and the law gave them far too few.',
    'Men who dug up the newly buried and sold them were called resurrection men, and families answered with iron mortsafes and watch-houses.',
    'At Hollowmere the watch itself was for sale, and a gap in the log shows when the lodge door stood open.',
    'The robbed rest, and their names are spoken again.',
  ],
  'sealed-catacombs': [
    'In the cholera winter of 1849 the parish feared the sick more than it feared its own conscience.',
    'Father Crane sealed living people in the catacombs, and the church that kept the doors closed has kept the ledger closed since.',
    'An undertaker was paid for burials that never took place, and the keeper before you learned too much.',
    'The rite is finished, the doors are open, and the names are written where they can be read.',
  ],
}
