# Player workflow audit (2026-11-21)

This file checks the game against an outside review that compared Last Rites with *Golden Idol*, *Obra Dinn*, *Dredge*, *CoD Zombies* and *Amnesia*. For each workflow it says what the game does today, gives a verdict, and says what happens next.

**Verdicts:**
- **Good** means good enough to ship.
- **Fixed** means it was fixed today.
- **Kiro** means it's in `docs/kiro-prompt-task-chain.md`.
- **Skip** means it isn't worth doing before the 26 November freeze.

## The biggest problem: steps had no reason

The game's main logic gap was that a step didn't say why it mattered or what it led to. The bells are the clearest case.

- **The bells.** They do matter: the ledger narrows the case to three graves, and the bells pick the one where someone was buried alive. But the objective only said "Examine the three bells". Any post opened all three, and once the bells were done the objective said nothing useful.
- **Stage 2.** It pointed at the crest lock, which stands behind a gate that needs a key, and the objective never mentioned the key.

**Fixed today:**
- **Why line.** Every stage step now shows one line under the objective saying what it's for. For example: "Someone was buried alive. A safety bell lets the buried ring for help: one was silenced." So do the page and craft-a-weapon objectives.
- **One bell per post.** Each post opens only its own bell, so the player walks to all three graves.
- **After the steps.** By day, once the steps are done, the objective says "Link the clues in the journal's Case tab (n/m)", then "At dusk, give your answer at the chapel altar", with the altar marker.
- **Stage 2 key and gate.** Stage 2 now opens with "Find the key to the Mausoleum Row gate", shown as a search ring on the maps, then "Open the Mausoleum Row gate".
- **Quiet when done.** Finished props no longer glow. The beacon, outline and rune mark only the next task.

## 1. Benchmarks

| Benchmark | What Last Rites does now | Verdict |
|---|---|---|
| *Golden Idol*: clues log themselves | The clue reveal writes every clue into the journal. Reading a stone adds its rubbing to the ledger cross-check. Case cards pin themselves. | **Good** |
| *Obra Dinn*: you know a clue is missing, and guessing is punished | The case line shows "clues n/m". A wrong altar answer brings a wave at once and 30 s of silence, and after two wrong answers you must link another pair first. But the board doesn't show *which* clue is missing or where. | Penalty **Good**; missing-clue cards **Kiro** |
| *Dredge*: dusk felt, not read off a clock | There's a "Dusk in m:ss" countdown, fog that thickens each stage, a 30 s dusk and the weapon reminder at 2 minutes. There are no bells, birds or other world cues before dusk. | **Kiro** (bell and crow warnings) |
| *CoD Zombies*: gaps between waves | Waves never stop, but there are 15 s between them and boards can be repaired in that gap. | **Good** |
| *Amnesia*: danger while you read | The journal pauses the game by day and keeps it running at night. Scares are held back while it's open, so they stay fair. | **Good** |

## 2. Workflows

### A. The first 10 minutes ("What am I doing, and why?")
- **Visual anchor.**
  - Now: you wake in the hut with the workbench ahead, and the objective pillar marks Elias's page.
  - Verdict: **Good**.
- **Mini-night tutorial.**
  - Now: none. The first-day tutorial teaches moving, interacting and digging, and the weapon reminder comes before dusk.
  - Verdict: **Skip**. A whole extra mini-night is a new system, and the freeze is in 5 days.
- **A trail to follow.**
  - Now: the objective pillar, the compass, the keeper's hunch (the HUD flame leans toward a clue after 2 minutes) and outlines on usable props. The why line now gives the reason as well as the place.
  - Verdict: **Fixed**.

### B. Daytime investigation ("Am I making progress, and when do I stop?")
- **Clues versus scenery.**
  - Now: usable props get a rune and an outline, and finished ones now go quiet.
  - Verdict: **Fixed**.
- **Auto-indexing.**
  - Now: done for clues and stones.
  - Verdict: **Good**. Highlighting names and dates in the text would be a nice extra, not needed.
- **Hands-on puzzles.**
  - Now: ledger lines, bell parts, crest dials, torn pages, boot casts and brass tiles.
  - Verdict: **Good**.
- **A reward for finishing the day early.**
  - Now: none. The player waits out the clock.
  - Verdict: **Kiro**. Ring the chapel bell to bring dusk early, for a little oil and a small score bonus.
- **The "oh no" moment at dusk.**
  - Now: the countdown and a 30 s dusk only.
  - Verdict: **Kiro**. Toll the far bell and send the crows up at 2:00, then have the graves tremble at 0:30. All of these sounds exist already.

### C. Night survival and deduction ("How do I fight and think?")
- **Chokepoints.**
  - Now: two chapel doors (front and vestry), each with barricade boards that break and get repaired.
  - Verdict: **Good**.
- **How combat feels.**
  - Now: block, kick (2 m shove and a stagger), dodge, heavy attacks that knock down, guns with scarce ammunition, and crafted throwables.
  - Verdict: **Good**.
- **Getting to the board quickly.**
  - Now: **J** opens the Case tab at once, and the night keeps running.
  - Verdict: **Good**.
- **Feedback on links.**
  - Now: a right pair gets a thick string, a ✓ and a note. A wrong pair costs nothing and says nothing.
  - Verdict: **Kiro**. A wrong string should sag and fall, so the player knows without being told the answer.
- **The altar.**
  - Now: a wrong answer brings a wave and silence. A right one turns the dead to dust and brings the sunrise.
  - Verdict: **Good**.

### D. Dawn and the next stage ("How am I getting stronger, and why care?")
- **A breather.**
  - Now: dawn waits until you pick an upgrade, and the travelling undertaker parks his hearse cart in the world.
  - Verdict: **Good**.
- **Builds.**
  - Now: 10 upgrades, three offered each dawn.
  - Verdict: **Good**. Named builds would be an extra.
- **A hook for the next stage.**
  - Now: the key comes from Pell's grave, and the stage 2 objective now says so and why.
  - Verdict: **Fixed**. Kiro adds a dawn line, "Something glints in Pell's grave."

## 3. What keeps players playing

| Driver | Now | Verdict |
|---|---|---|
| Feeling clever | Each right link lowers the Curse meter, and a quick answer ends the night sooner | **Good** |
| Enemies change, not just grow | Shamblers, then wailers, bloaters, brutes, lurkers, pale crawlers that grab, the Hollow Bride, corpse hounds, the grave witch, and Father Crane | **Good** |
| Scares you earn | The scare director warns first, the crawler grabs your leg, and the noises come from the world | **Good** |
| Replays | End-of-run stats, achievements, Endless and Short Vigil. There are no par times. | **Good**; par times would be an extra |
| Clues seeded for the epilogue | Silas's receipt in stage 1, then the flyleaf and the ledger's handwriting in stage 3 | **Good** |

## 4. Gaps left in the step chain (for Kiro)

- **Crest lock.** It needs the six crypt tablets, but no step tells the player to read them. Add "Read the crypt tablets (n/6)".
- **Stage 3 evidence cards.** They aren't a step. Add "Find what happened to Elias (n/6)", with search areas.
- **Hymn board.** It should point at the psalter in the vestry.
- **Step completion.** Finishing a step should say what was learned, as a short reveal line, before the next objective appears.
