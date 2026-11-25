// What the keeper says aloud through Case 2, "The Resurrection Men" (playtest story pass: every find
// says what it is, with full names, what it means and what to check next). Pure data. Names, dates
// and the receipt match `cases.ts`.

import type { BootId, FreshGraveId } from './cases'

export const CASE2_SAY = {
  /** Stage 2's first day: Elias's next note. */
  page: [
    'Elias’s next note: “Vane’s men are taking the dead too. Watch the fresh graves.”',
    'He thought bodies were being stolen from new graves. Surgeons pay for bodies to cut up and study, and the men who dig them up are called resurrection men.',
    'There are three fresh graves by the lodge. I’ll look at each one, then check them against the burial register on the lodge table.',
  ],
  /** Inspecting a fresh grave. */
  grave: {
    cobb: 'Ellen Cobb, buried the 9th of October. The soil’s settled and the grass is coming through. Nobody’s touched it.',
    reade: 'Thomas Reade, buried the 11th. Settled and firm. Nobody’s touched this one either.',
    finch: 'Arthur Finch, buried the 14th. The soil’s loose, there’s yellow clay all over the grass, and I can see the coffin lid.',
  } as Record<FreshGraveId, string>,
  /** All three graves inspected. */
  gravesDone: 'That’s all three fresh graves. Now the burial register on the lodge table.',
  /** Opening the register the first time. */
  registerOpen: [
    'The burial register: Ellen Cobb, Thomas Reade and Arthur Finch.',
    'For each one I’ll mark whether the grave agrees with what’s written here.',
  ],
  /** A register line marked right. */
  registerRight: {
    cobb: ['Ellen Cobb’s grave matches the register. Buried the 9th, and nobody’s touched it.'],
    reade: ['Thomas Reade’s grave matches too.'],
    finch: [
      'This doesn’t match. The register says Arthur Finch was buried on the 14th, filled and settled.',
      'But the soil’s loose and there’s yellow clay all over the grass. Someone dug it up and filled it back in. The coffin’s empty. The body’s gone.',
    ],
  } as Record<FreshGraveId, readonly string[]>,
  /** Marking the robbed grave as agreeing. */
  registerNotAgree: 'Look again. The register says settled, but that grave isn’t.',
  /** Marking an untouched grave as disturbed. */
  registerNotDisturbed: 'No. That grave’s settled. Nobody’s touched it.',
  /** All three lines marked. */
  registerSolved: [
    'So Arthur Finch’s grave was robbed on the night of the 14th, or after.',
    'The lodge keeper, Kerr, writes down every night’s rounds. I’ll read his watch log for the 14th.',
  ],
  /** Opening the watch log. */
  watchOpen: 'The watch log for the night of the 14th. Kerr walks the rounds, and Dale, the night porter, countersigns each one.',
  /** Clicking a box Dale did sign. */
  watchSigned: 'Dale signed that one. He was with Kerr at that hour.',
  /** Clicking an empty countersign box. */
  watchSolved: [
    'Midnight and two o’clock: Kerr says “all quiet”, but nobody countersigned. Dale wasn’t with him.',
    'Kerr was out alone for those rounds, on the night Arthur Finch’s grave was emptied. And Kerr is the lodge keeper.',
    'There was a boot print at the robbed grave. I’ll take it, then compare it with the boots by the lodge table.',
  ],
  /** Taking the print at the robbed grave. */
  print: [
    'A boot print in the mud at the foot of Arthur Finch’s grave: hobnails, a square heel, and a crack straight across the sole.',
    'I’ve sketched it in my journal. Now the boots by the lodge table.',
  ],
  /** Opening the boots without the print. */
  bootsNoPrint: 'I need the print from the robbed grave to hold these against.',
  /** Kerr's boots held against the print. */
  bootRight: [
    'Kerr’s boots. Same hobnails, same crack across the sole, and the same yellow clay from the grave. Kerr dug it up himself.',
    'There’s a key in his boot. It’s for a locker, but the lock on it isn’t an ordinary one.',
  ],
  /** A wrong pair held against the print: the line is the boot's own `wrong`. */
  bootWrong: {
    visitor: 'No. That’s a narrow heel and no nails. Not these.',
    dale: 'No. A broad, low heel, hardly any nails, and no crack. Not Dale’s.',
    kerr: '',
  } as Record<BootId, string>,
  /** Kerr's locker before the boots give up its key. */
  lockerNoKey: 'Kerr’s locker, from Vane & Sons. It’s locked, and I don’t have the key.',
  /** First look at the crest lock. */
  lockerFirst: [
    'A crest lock. Vane & Sons lockers have them: the key turns only once the dial is set to the right family crest.',
    'I’ve seen one of these crests before: the wax seal on John Pell’s tag, the raven on the coffin. That was the Vane crest.',
  ],
  /** The key tried with the wrong crest under the arrow. */
  crestWrong: 'Won’t turn. It wants a particular crest.',
  /** The locker opens. */
  lockerOpen: [
    'It opens. There’s a bone whistle in here, and a receipt.',
    '“Received of Vane & Sons, for three subjects delivered to Dr. Hollis, surgeon: twelve pounds. Paid to Kerr.”',
    'Subjects means bodies. Vane & Sons paid Kerr to dig up the dead and sell them to a surgeon.',
    'And this neat, sloping hand is the same as the changed entries in the parish ledger.',
    'When night falls, I’ll name who paid at the chapel altar.',
  ],
  /** The altar question answered right. */
  solved: ['Vane & Sons. Kerr digs, and the Vanes pay.', 'First John Pell, now this. Elias was getting too close to them.'],
} as const
