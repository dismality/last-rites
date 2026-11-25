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
  // Case 2 is the keeper's write-up too, written across the page at the altar.
  'resurrection-men': [
    'The grave buried on the 14th, Arthur Finch’s, was robbed.',
    'Kerr was out alone from midnight to 2 am, with no countersign.',
    'His boots match the print, with the grave’s yellow clay still on them.',
    'His locker opened to the Vane crest, and inside was a receipt.',
    'Vane & Sons paid Kerr to dig up the dead and sell them.',
    'What this proves: the keeper digs, the Vanes pay, and Elias was getting close.',
  ],
  // Case 3 is the keeper's write-up as well, written across the page when the altar holds the name.
  'sealed-catacombs': [
    'Elias followed the Vanes from John Pell’s grave to the stolen bodies.',
    'Silas Vane wrote to him and asked to meet at the Crane crypt.',
    'He shut the door on him and pinned it from outside with his own hearse pin.',
    'Elias was alive. He tried to claw his way out.',
    'Silas Vane sealed him in.',
    'What this proves: one hand wrote the ledger, the receipt and the note. The son kept the books, and the son shut the door.',
  ],
}
