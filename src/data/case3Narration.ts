// What the keeper says aloud through Case 3, "The Sealed Catacombs" (playtest story pass: every find
// says what it is, with full names, what it means and where to go next). Pure data. Names and
// places match `cases.ts`: the Crane crypt closes the end of Mausoleum Row.

export const CASE3_SAY = {
  /** Stage 3's first day: Elias's last page. */
  page: [
    'Elias’s last page: “I’m going below the chapel tonight. If I don’t come back, look for the Crane crypt.”',
    'There must be a way down below the chapel. The hymn board in the chapel has been changed. I’ll start there.',
  ],
  /** The hymn board solved (3a): the stair opens. */
  hymnSolved: [
    'These hymn numbers make no sense for a service. Take the first letter of each hymn: B, E, L, O, W. Below. Elias set this. The catacombs are under the chapel.',
    'There it is. The stair behind the altar.',
    'But his page named the Crane crypt, at the far end of the Row. There are cart ruts at the Row gate. I’ll follow them first.',
  ],
  /** The cart ruts at the Row gate. */
  ruts: 'Wheel ruts, deep ones. A heavy cart came down the Row and went back out. A hearse cart. I’ll follow them.',
  /** The spilled oil at the Lowe crypt (the false lead). */
  oil: 'Spilled lantern oil at the Lowe crypt, still wet. Someone was here, but there are no cart ruts. Nobody brought a cart to this door. It’s not this one. I’ll keep following the ruts.',
  /** The pin pulled from the Crane crypt door (3b), and what is behind it. */
  door: [
    'The ruts stop at the Crane crypt. This is the door Elias wrote about.',
    'The door’s pinned shut from the outside. You can’t open that from inside. Someone shut this on purpose.',
    'This pin’s off a hearse cart, and it has the Vane raven on it. The ruts outside were a hearse cart. The Vanes’ cart.',
    'Elias. He’s here. There are fingernail marks all over the inside of the door. He was alive when they shut him in, and he tried to claw his way out.',
  ],
  /** The door is still pinned, and Elias is not reachable yet. */
  eliasShut: 'The door’s pinned shut. I have to pull the pin first.',
  /** Searching Elias (3c): the letter and the note. */
  elias: [
    'There’s a letter in his coat that he never sent, and a note. He came here to meet someone: the man who wrote asking to meet him at the Crane crypt.',
    'I’ll lay the note beside the other papers in my journal and compare the hands.',
  ],
  /** The handwriting page first opened in the journal. */
  handOpen: 'Four hands side by side: the changed ledger entry, the receipt from Kerr’s locker, the note that called Elias here, and Josiah Vane’s signature on John Pell’s tag.',
  /** Every sample compared (3d). */
  handSolved: [
    'The ledger, the receipt, and the note that brought Elias here: all the same hand, with the looped V and the long s.',
    'But Josiah’s signature on Pell’s tag is plain and shaky. This isn’t the father’s writing. It’s the son’s.',
    'Silas Vane keeps the books for Vane & Sons. He changed the ledger for his father, he paid Kerr for the bodies, and he wrote the note that lured Elias to the crypt.',
    'Silas Vane sealed Elias in this crypt. Tonight I’ll name him at the altar, then lay the relics for the rite.',
  ],
  /** The name given at the altar. */
  named: ['Silas Vane. Elias, I found you. You can rest now.'],
} as const
