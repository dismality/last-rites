// Closed-case pages (spec 10 task 2.1, Req 7.1 and 7.5). Each page is 3 to 5 sentences of real
// history, told with respect and no gore. They appear in the journal once a case is solved.
// Pure data. Shown one sentence per paragraph, so keep every entry a single sentence.

import type { CaseId } from './stages'

export const CLOSED_CASE_PAGES: Readonly<Record<CaseId, readonly string[]>> = {
  'saved-by-the-bell': [
    'In the nineteenth century many people feared being buried before they were truly dead.',
    'Inventors sold safety coffins with a bell on a rope, so that anyone who woke below could call for help.',
    'Pell was laid down on a certificate signed before the hour of his death, and the rope that might have saved him was cut.',
    'The keeper heard what the bell never rang, and the curse lets the first night go.',
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
