# Kiro prompt: every task leads to the next

Paste everything below the line into Kiro.

---

This is a new task from the user's playtest. Add it as **11r** to `.kiro/specs/09-playtest-fixes/tasks.md`, then do it after the task you're on now.

Same rules as always:
- read the design bible (`docs/game-design.md` §11, §13) first, and update it when a rule changes;
- add a kiro-log entry;
- lint, build and unit tests must pass;
- commit locally, **never push**;
- anything you decide without the user goes under "Decisions made unattended".

## What the user asked for

In the user's words: "clearing each objective should grant the key to the next task, and the next task should appear as navigation, there must be a proper reason to solve each task, like how things lead to the altar, the key, etc". Also: "the yellow beacon should only be for each next task".

So every step of a stage has to:

1. **Give something** when done: an item, a key, a clue card, or a door or prop that opens. The thing it gives is what the next step needs.
2. **Say why.** Every step already shows a why line under the objective (see "Already done"). What's still missing is a one-line **completion** reveal in the keeper's voice: what was learned and where it points. Show it as the clue reveal or the zone-card style caption, not a toast. Example: "Three burials don't add up. Each of those graves has a safety bell."
3. **Hand over the navigation.** Make the next step the objective at once.
   - If the player has been told where the place is, it's a **point** (the amber pillar and the map diamond).
   - If they've only been told roughly where, it's a **search area** (a ring on the maps, `place.kind: 'area'`, already built; see "Already done").
   - The beacon, the outline and the rune go **only** on the current step's target. Finished props stay quiet.

## Already done outside Kiro (2026-11-21)

Don't redo these; build on them. `docs/workflow-audit.md` has the full audit behind this task.

- **Why lines.**
  - `StageDayRule.why` (required) and `ObjectiveRuleDef.why` (optional) feed `Objective.why`.
  - The tracker shows it in italics under the main line.
  - The case-board and altar lines have their own (`CASE_LINK_WHY`, `CASE_ALTAR_WHY`).
  - The limit is `OBJECTIVE_WHY_MAX` (100 characters). Write the why line for every new step you add.

- **Search areas.**
  - `StageDayPlace` has `{ kind: 'area', at, radiusM }`, and `Objective.areaM` carries the radius.
  - The big map, journal map and minimap draw a dashed ember ring with a soft wash (`drawSearchArea` in `src/ui/journal/mapDraw.ts`, and `minimapDraw.ts`).
- **Stage 2 starts with its key and gate.**
  - `STAGE_DAY_RULES[2]` now opens with "Find the key to the Mausoleum Row gate" (a 7 m search area near Pell's grave), then "Open the Mausoleum Row gate" (a point at the gate). The crest lock, watch log and casts follow.
  - Each rule can name its `minigame`; the keeper's hunch now finds a minigame's place by that field, not by list index.
- **After the day steps.**
  - By day, once every step is done, the objective is "Link the clues in the journal's Case tab (n/m)".
  - Once every link is made, it becomes "At dusk, give your answer at the chapel altar", with the altar marker. This is `stageDoneObjective` in `src/game/systems/objective.ts`.
- **Bell posts.** Each post opens only its own bell. The cut bell is named at its own post once all three are examined.
- **Finished props.** A prop whose cue is idle (for example "The bells are examined") no longer gets the hover outline, the proximity outline or the rune (`Interactable.tsx`).

## The chain to build

Walk each stage, and for every step fill in: what it gives, the "why" line, and the next target (point or area). The gaps the user hit, and what to do about them:

### Stage 1: Saved by the Bell
- **Elias's page (journal page 1).** It should point at the parish ledger on the hut shelf, for example: "The register and the stones disagree. Check them against each other." Next: the ledger (point).
- **Ledger cross-check (1a).** It gives the bell posts (they already rise when 1a is solved). The why line names the three graves and their bells. Next: the nearest unexamined bell (point).
- **Bells (1b).** It gives the pinned clue cards. The why line says the case board is ready. Next: link the clues (done), then the altar at dusk (done).
- **Night.** Answer at the altar.
- **Dawn.** Pell's grave gives up the Rusted Crypt Key. Say so at dawn, for example: "Something glints in Pell's grave." Then the stage 2 key step takes over. Check that the key is really dug or picked up, and make the prompt match.

### Stage 2: The Resurrection Men
- **Key, then gate.** The key is a search area and the gate is a point; both are done.
- **Gate opened.** The why line says the crypt tablets on the avenue railing record the founders. Add a **"Read the crypt tablets" step** (count 0 to 6) before the crest lock, because the crest lock can't be solved without them and nothing tells the player that today.
- **Crest lock (2a).** It gives the Bone Whistle and the sexton's watch ledger. The why line should send the player to the gatekeeper's lodge, for example: "The watch ledger is torn. The pages were left in the lodge." Next: the lodge table (point).
- **Watch log (2b).** It shows the two-hour gap on the lodge keeper's watch, the night the Ames grave was robbed. The why line points at the Ames grave. Next: the casts there (point).
- **Boot prints (2c).** Then link the clues and answer at the altar (done).

### Stage 3: The Sealed Catacombs
- **Hymn board (3a).** It should explain the psalter, which lies in the vestry cupboard. Next: the psalter (point), then the altar tiles.
- **Whistle at the altar.** It opens the stair; the why line says so. Next: the stair (point).
- **Evidence cards.** They aren't a step today. Add an **"Find what happened to Elias" step** (count 0 to 6) with a search area per unfound card, ahead of the slate.
- **Slate (3b).** It gives the pin, the crypt and the Iron Ossuary Key. Next: the relics. Each relic the player has heard of is a point, and one they've only heard about is a search area (the locket on the west hill, at night).
- **The rite.** Already guided.

## Workflow items from the audit

Do these after the chain, in this order. Each one is small and uses sounds and systems that already exist.

1. **Dusk you can feel.**
   - At 2:00 before dusk, toll the far village bell (`allHallows` bell) and send the crows up from the oaks.
   - At 0:30, the grave mounds tremble with a low rumble.
   - Give each a subtitle. This doesn't replace the countdown.
2. **Ring for dusk early.**
   - Once every day step of the stage is done, the chapel bell rope gets a prompt: "Ring the bell: call the dusk now".
   - Ringing it starts dusk at once and pays a small reward (+15% oil and a score bonus).
   - It never appears before the steps are done.
3. **Missing-clue cards.**
   - The case board shows a face-down card for each clue not yet found, labelled with the zone it's in ("Somewhere in Mausoleum Row").
   - Clicking it sets that zone as a search-area objective.
4. **Feedback on wrong links.**
   - A wrong pair's string sags and falls away after 1 s, with a soft thread-snap sound and a "[the thread slips]" subtitle.
   - It still costs nothing and says nothing about the answer.
5. **Dawn hook.** At dawn after stage 1, show "Something glints in Pell's grave." before the key step takes over.

Don't build the mini-night tutorial the review suggested: it's a new system, and the freeze is close.

## Decide with the user first

Ask the user before doing either of these, and record the answer:
- **Physical locks.** Should some steps get a real lock (for example the lodge door only opens with the crest lock's key), or are the "why" line and the navigation enough?
- **The board at night.** Should the link-the-clues line also show at night, under the curse line?

## Tests

- **Unit tests.** For each stage, list the steps in order and check that each one's completion makes the next one the objective, with the right kind of place (point or area).
- **e2e.** Extend `e2e/support/story.ts`: after each step, the objective text changes to the next step, and the beacon stands at the next target.
- **Design bible.** Update the §11 objective table and the §13 case sections to match.
