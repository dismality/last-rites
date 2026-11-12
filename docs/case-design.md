# Last Rites: The Cases (spec 10 design)

This is the detailed puzzle design for spec `10-curse-stages`. It builds on Part E of `docs/kiro-prompts.md` (the user's decision of 2026-11-10) and adds what was decided on 2026-11-11:
- every case is solved through small **puzzle minigames**, not by collecting;
- stage 3 also reveals that **Silas Vane murdered Elias**.

Where this file and Part E disagree, this file wins.

## 1. Structure (from Part E)

- **3 stages,** each one day plus one night.
- **Day:** no zombies anywhere. The player explores, gathers, crafts, and plays that case's **day minigames**. Each minigame, once solved, gives a key clue or opens a place.
- **Night:** the curse holds back the sun. Waves never end and get harder each wave until the player gives the case's **final answer at the chapel altar**.
  - A correct answer stops the waves, collapses the zombies into dust and plays a sunrise.
  - A wrong answer spawns a wave at once and locks the altar for 30 s. It never ends the run.
- **Next stage:** the next case's clues replace the old set. Solved cases move to a **Closed cases** journal tab, each with a 3–5 sentence "what really happened" page on the history behind the legend.
- **Win:** solve all 3 cases. The keeper walks out of the gates at sunrise (E5).

## 2. The Case board (E3)

A journal tab, **Case**, styled as a cork board. It's the most polished screen in the game; the Costume Contest judges UI.
- **Clue cards:** each clue is a pinned card (title, one line, small icon). Cards appear when found. Nothing is auto-solved.
- **Red string:** drag (or keyboard: select a card, then the other, then Enter) between two cards. A pair that belongs together shows a short deduction note, e.g. "Same hand as the ledger". These notes are the steps toward the answer.
- **Final question:** shown at the bottom as a sentence with slots, e.g. "The one buried alive lies in ___ because ___." It can be filled by day, but it can only be **answered at the altar**.
- **The journal at night (F8):** by day it pauses the game. At night it doesn't: the screen dims and sounds go on.
- **Hints:** three tiers per case, each costing Grave Coins.
  1. Which cards matter.
  2. The rule to apply.
  3. The answer.
  - In Story difficulty, tier 3 is free once the night has run 3 minutes, so no judge gets stuck.
- **Doubt:** a wrong answer in a **day** minigame adds one extra shambler to that night's first wave (at most +3 a night) and costs 50 score. Solving a case with no hint and no wrong answer gives +300 "Sharp Eye". Achievement *Case Closed*: all 3 cases solved with no hints.

## 3. The cases

Every answer must follow from the in-game clues alone. Each case has 6–8 clues, and at least 2 of them are red herrings. All answers and texts live in `src/data/cases.ts`.

### Stage 1: "Saved by the Bell" (buried alive)
Safety coffins had a bell on a rope so someone wrongly buried could signal.
- **Minigame 1a, Ledger Cross-check (hut and grounds):**
  - The hut shelf holds the parish ledger page: 8 entries with date, plot, cause and doctor.
  - Players read the readable stones (Marsh, Hale, Ames, Pell, plus 2 new ones) and open a two-page spread: ledger left, stone rubbings right.
  - They draw lines from stone to ledger line and flag mismatches (date, plot, missing certificate). Three right flags narrow the case to **3 candidate graves**.
- **Minigame 1b, The Bells (the 3 candidate graves):** each candidate has a safety-bell post.
  - **Examine view:** turn the bell, inspect the rope, read the tag.
  - **Clues:** one rope is cut clean (a knife, not rot); one bell is rusted solid (it never rang); one tag carries the hurried certificate's date, which is a day *before* the ledger says the person died.
- **Red herrings:** fresh flowers on Hale (a widow still visits) and a toppled Marsh stone (frost heave).
- **Final answer at the altar:** "The one buried alive lies in **Pell's grave** because **the bell rope was cut and the certificate was signed before the death**."
- **Reward:** sunrise, and Pell's grave holds the **Rusted Crypt Key** for stage 2. The dig mound marks once the case is solved.

### Stage 2: "The Resurrection Men" (body snatchers)
Graves were robbed for anatomy schools; iron mortsafes and watch-houses were built against it.
- **Suspects:** the sexton, the doctor, the lodge keeper, the gravedigger.
- **Minigame 2a, The Crest Lock (Mausoleum Row):**
  - The sexton's niche at (−21.2, −52.5) has four dials of family crests (use the new rune and mark images).
  - The note in the gatekeeper's lodge reads "Turn them in the order the founders were laid down"; the years are on the 6 crypt name tablets.
  - Solving it gives the **Sexton's Bone Whistle** and the sexton's ledger of night watches.
- **Minigame 2b, The Watch Log (the lodge):** the watch-house logbook's night entries are torn out and scattered. The player puts 8 entries in time order. This reveals a **2-hour gap** on the night the Ames grave was robbed, and whose watch it was.
- **Minigame 2c, Boot Prints (the Ames grave):** compare 3 plaster casts of prints at the grave with the 4 suspects' boots (examine views): tread, size, the hobnail pattern. One matches.
- **Other clues:**
  - a surgeon's receipt for "subjects" (Mausoleum Row);
  - a spade with fresh clay (gravedigger's shed, a red herring: he dug a legal grave that day);
  - a doctor's anatomy school letter (a red herring: he bought legally, with a licence).
- **Final answer (red-thread accusation):** "The bodies were sold by **the lodge keeper**. Motive: the surgeon's receipt in his hand. Means: the matching boots. Opportunity: the gap on his watch."
- **Reward:** sunrise, and the whistle and stair lead into stage 3.

### Stage 3: "The Sealed Catacombs" (Father Crane), with the Silas reveal
The existing story stays: Crane sealed 31 living people in the catacombs in 1849.
- **Minigame 3a, The Hymn Board (chapel):**
  - The board reads 4 · 19 · 2 · 41 · 23. The vestry psalter's index lists hymns 1–60 by title.
  - Crane's confession fragment says: "What I hid, I hid beneath the Word."
  - The first letters of those hymns spell **BELOW**. The player sets five brass letter tiles on the altar and blows the whistle, and the hidden stair opens.
- **Minigame 3b, Elias's Last Night (Crane crypt):** six evidence cards go on a midnight-to-dawn timeline:
  1. the dry boots in the hut;
  2. Elias's unsent letter to the Bishop, hidden in the hut bench;
  3. hearse-cart ruts at the Row gate;
  4. lantern oil spilled at the crypt step;
  5. fingernail marks inside the crypt door;
  6. an iron hearse-pin still in the door's outer hasp.

  The right order replays his night in captioned beats and shows he was **sealed in alive**. Pulling the pin opens the crypt: Elias's body and the **Iron Ossuary Key**.
- **The Silas reveal:**
  - The ledger's "same careful hand" is **Josiah Vane's**, the 1849 parish undertaker, paid for 31 funerals that never happened. His name is on a ledger flyleaf in the ossuary.
  - Silas Vane, his son and the dawn merchant, gives the player a **Vane & Sons receipt** with their first purchase in stage 1. The handwriting matches.
  - Elias's letter names "the undertaker's family".
- **Final answers at the altar (night 3, waves running, Father Crane rises at the first one):**
  1. **The rite (Part E E2):** place the 5 relics in the order given by Crane's confession and Elias's notes (a relic-placement minigame on the altar, replacing "hold E for 45 s"). This lifts the curse; the run is won.
  2. **The accusation:** "Elias was sealed in by **Silas Vane**. Motive: the handwriting. Means: the hearse-pin. Opportunity: the cart ruts."
     - This is optional and doesn't affect the win. A right answer adds the epilogue: Silas's cart is found at the gate at sunrise, empty, the receipt book open on the seat, and the ledger goes to the Bishop. Achievement *Justice for Elias*.
     - A wrong answer or none: "Silas Vane's cart rolled away at dawn, as it always does."
- Silas trades as normal at every dawn before that, so the economy is untouched.

## 4. Night: a puzzle inside the fight (cuttable)
**Name the Dead,** stages 2 and 3: during waves, one opening grave per wave glows faintly and shows a name.
- If that name is in the case evidence, holding Interact for 3 s there speaks it and **seals the grave** for that wave (+100 score).
- Taking damage breaks the hold. An unknown name shows "You don't know who lies here."

## 5. Rules for every minigame
- Each minigame is its own overlay. It uses the shared cursor-release hook from spec 09 task 11h, has no timer by day, and works fully by keyboard.
- The text is real text: plain-font setting honoured, colour never the only signal, captions for every sound.
- Answers are in data (`src/data/cases.ts`); rules are pure functions (`src/game/systems/case*.ts`).
- Property tests:
  - wrong answers are always rejected, right answers always accepted;
  - hint tiers reveal in order;
  - Doubt is capped;
  - clue sets swap per stage;
  - state rebuilds on Continue and resets on New Game and Retry;
  - every answer's clues are reachable in that stage.
- Endless Survival skips the cases.
- New props (bell posts, plaster casts, letter tiles, hymn board, hasp pin, name tablets) are simple meshes.
  - They must clear the gameplay anchors and waypoint edges and add no lights.
  - The crypt name tablets go on the tablet faces the new scene already has on each crypt front.

## 6. Order and cuts (deadline Dec 4, feature freeze Nov 26)

**Build order:**
1. E1 stage loop
2. Case board
3. Stage 1 (1a, 1b)
4. Stage 3 (3a, 3b, rite, Silas)
5. Stage 2 (2a, 2b, 2c)
6. E5 win cutscene
7. E11 help and Short Vigil
8. E7 kill-cam
9. E9 stamina
10. E4 tiered crafting
11. Name the Dead

**If time runs short, cut in this order:** Name the Dead, E4, minigame 2c, minigame 2a (keep the whistle where it is now), E9. Do not cut the case board, stages 1 and 3, the rite, E1 or E5. E6, E8 and E10 are stretch only.
