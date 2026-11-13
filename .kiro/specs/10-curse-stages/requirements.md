# Requirements Document

Spec 10: Curse Stages and Cases

## Introduction

This spec replaces the five-night structure with **three stages**, each one day plus one night, each a **case** solved through puzzle minigames and a final answer given at the chapel altar. By day there are no zombies and the player explores, gathers, crafts and plays the case's day minigames. By night the curse holds back the sun: waves never end and escalate until the case is answered correctly at the altar. The cases are *Saved by the Bell* (stage 1), *The Resurrection Men* (stage 2) and *The Sealed Catacombs* (stage 3, with the Silas Vane reveal).

The source of truth for content and numbers is `docs/game-design.md` (§13 and every row tagged (10)). The detailed puzzle design is `docs/case-design.md`, which wins where the two differ. Part E (E1 to E11) and F8 of `docs/kiro-prompts.md` give the original intent. Requirement order follows the build order of case-design §6. Items E6, E8 and E10 are stretch goals and are not scheduled (Requirement 31).

Every case and minigame requirement carries the same five acceptance checks: a right answer, a wrong answer, keyboard-only play, a Playwright test that solves it with a real mouse and keyboard, and screenshots at 1280x720 and 800x600 in `e2e/screenshots/`.

## Glossary

- **Stage**: one of three units of play, each one day, one dusk, one night and one dawn, numbered 1 to 3.
- **Stage_System**: the pure state machine in `src/game/systems/stage.ts` that moves a run through the Stage phases.
- **Case**: the deduction puzzle of one Stage, defined in `src/data/cases.ts`.
- **Case_System**: the pure functions in `src/game/systems/case*.ts` that hold the rules of Cases, links, answers, hints and Doubt.
- **Case_Store**: the zustand store `caseStore` holding the player's progress on Cases.
- **Case_Board**: the journal tab "Case", a cork board of pinned Clue_Cards joined by red string.
- **Clue_Card**: a pinned card on the Case_Board with a title, one line of text and an icon.
- **Red_String**: a link between two Clue_Cards made by mouse drag or by keyboard selection.
- **Deduction_Note**: the short note shown when a Red_String joins two cards that belong together.
- **Final_Question**: the sentence with slots at the bottom of the Case_Board that is answered at the Altar.
- **Altar**: the chapel altar where the Final_Question is answered and the Rite is performed.
- **Altar_Lock**: the 30 s period after a wrong answer in which the Altar accepts no answer.
- **Curse_Meter**: the number and bar (default 10 steps per Case) that falls with each correct Red_String link.
- **Minigame**: a puzzle overlay of a Case: 1a, 1b, 2a, 2b, 2c, 3a or 3b.
- **Minigame_Shell**: the shared overlay frame used by every Minigame.
- **Doubt**: the penalty for a wrong day-Minigame answer: one extra Shambler in the night's first wave (at most +3 a night) and 50 score.
- **Sharp_Eye**: the +300 score bonus for solving a Case with no hint and no wrong answer.
- **Case_Closed**: the achievement for solving all three Cases with no hints.
- **Hint_Tier**: one of three hints per Case: 1 which cards matter, 2 the rule to apply, 3 the answer.
- **Rite**: the Stage 3 relic placement at the Altar that replaces the 45 s hold.
- **Accusation**: the optional Stage 3 answer naming Silas Vane.
- **Wave_Director**: the pure wave sequencer in `src/game/systems/waves.ts`.
- **Dev_Panel**: the playtest panel in `src/dev/`, enabled only by `?dev=1` or `import.meta.env.DEV`.
- **Debug_Hook**: the dev-only `window.__lastRites` API in `src/debug/debugHook.ts`.
- **Retry_Snapshot**: the dusk and morning snapshots in `src/game/systems/duskSnapshot.ts` and `src/game/state/retryNight.ts`.
- **Short_Vigil**: the Story option with 3 Stages and 2-minute days.
- **Cursor_Release**: the shared cursor-release hook in `src/scene/player/cursorRelease.ts`.
- **Objective_Tracker**: the top-left objective panel driven by `guidanceStore.objective`.
- **Real_Input_Test**: a Playwright test that uses `page.mouse` and `page.keyboard` and does not call the Debug_Hook to set an answer.
- **Screenshot_Pair**: one screenshot at 1280x720 and one at 800x600 saved into `e2e/screenshots/`.
- **Win_Cutscene**: the 15 to 20 s walk out of the gates after the Stage 3 sunrise.
- **Kill_Cam**: the grab close-up of E7.
- **Name_The_Dead**: the night puzzle where a glowing grave shows a name to speak.

## Requirements

### Requirement 1: Three-stage structure (E1)

**User Story:** As a player, I want three stages of one day and one night each, so that a run has a clear shape and each case has its own night.

#### Acceptance Criteria

1. THE Stage_System SHALL run exactly 3 Stages in Story modes, each in the order day, dusk, night, dawn.
2. WHILE a Stage is in the day phase, THE Wave_Director SHALL spawn no zombie of any type.
3. WHEN the dawn of Stage 1 or Stage 2 ends, THE Stage_System SHALL start the next Stage at day and swap in that Stage's Case.
4. WHEN the dawn of Stage 3 ends, THE Stage_System SHALL start the Win_Cutscene.
5. WHERE the mode is Endless Survival, THE Stage_System SHALL skip Cases, Doubt and hints and keep the Endless wave formula.
6. THE Stage_System SHALL replace the five-night constants (`LAST_NIGHT`, `NIGHT_FOG_DENSITY`) in `src/data/balance.ts` with Stage data in `src/data/stages.ts` that mirrors `docs/game-design.md` §8 and §13.
7. WHEN a Stage dawn starts, THE Stage_System SHALL unlock the recipes the bible assigns to that dawn (Stage 1 dawn: Sharpened Shovel, Holy Water Flask, Lantern Trap; Stage 2 dawn: Nail Bomb, Blessed Rounds).
8. THE Stage_System SHALL keep the barricades, the day and dusk lengths, the merchant and the contracts working with Stages.

### Requirement 2: Endless escalating nights (E1)

**User Story:** As a player, I want the night to keep coming until I solve the case, so that the case answer is the only way to end the siege.

#### Acceptance Criteria

1. WHILE the Case of the current Stage is unsolved and the phase is night, THE Wave_Director SHALL keep producing waves without end.
2. WHEN the Case of the current Stage is solved, THE Wave_Director SHALL stop spawning within the same simulation tick.
3. THE Wave_Director SHALL draw each wave from the difficulty ladder rows of docs/game-design.md §8 (Stage 1 rows 1 then 2, Stage 2 rows 3 then 4, Stage 3 row 5), moving to the later row from the fourth wave.
4. WHEN a night passes the last ladder row of its Stage, THE Wave_Director SHALL add 1 Shambler to each further wave and 1 Wailer or Lurker (alternating) to every third further wave.
5. THE Wave_Director SHALL give each wave a total enemy count and a strength score no lower than the wave before it within the same night.
6. THE Wave_Director SHALL keep at most 12, 16 and 20 zombies alive at once in Stages 1, 2 and 3, and SHALL hold queued spawns until there is room.
7. IF a zombie has been out of reach for 20 s, THEN THE Wave_Director SHALL despawn it and count it as banished.
8. THE Wave_Director SHALL begin the next wave 20 s after the previous wave's last zombie falls or 60 s after the previous wave began, whichever comes first.
9. WHILE a night is running, THE Wave_Director SHALL ring the bell 20 s before each wave if the bell is repaired.
10. THE Wave_Director SHALL set fog density by Stage (0.02 rising to 0.03, 0.04 rising to 0.05, 0.06) and not by wave.
11. THE Wave_Director SHALL allow elites from the fourth wave of Stage 1 and door attackers from the fourth wave of Stage 1.
12. WHEN the Case is solved, THE Stage_System SHALL collapse every living zombie to dust, play the sunrise and start the dawn screen.

### Requirement 3: Answering at the altar (E1, F8)

**User Story:** As a player, I want to give my answer at the altar and live with a wrong one, so that I cannot brute-force a multiple-choice case and the night still has teeth.

#### Acceptance Criteria

1. WHEN the player gives a correct Final_Question answer at the Altar during a night, THE Case_System SHALL mark the Case solved and THE Stage_System SHALL end the night.
2. WHEN the player gives a wrong answer at the Altar, THE Wave_Director SHALL spawn a wave at once and THE Case_System SHALL start the 30 s Altar_Lock.
3. WHILE the Altar_Lock runs, THE Altar SHALL reject every answer and THE Objective_Tracker SHALL show "The altar is silent: 0:24" with the seconds left.
4. WHEN the player has given 2 wrong answers on the same Case, THE Case_System SHALL require one new correct Red_String link on the Case_Board before the next answer is accepted.
5. IF the player tries to answer during the day, THEN THE Altar SHALL show the prompt "The curse does not stir by day" and accept no answer.
6. THE Altar SHALL accept an answer only at the Altar, even when the Final_Question was filled in earlier.
7. A wrong answer SHALL NOT end the run or deal damage.
8. WHEN a wrong Accusation is given in Stage 3, THE Altar SHALL spawn no wave and start no Altar_Lock.

### Requirement 4: State across Retry, Continue and New Game (E1)

**User Story:** As a player, I want my case progress to survive a retry or a reload, so that dying never costs me the clues I earned.

#### Acceptance Criteria

1. WHEN the player chooses Retry Night, THE System SHALL return to the start of the current Stage's dusk and keep the Case's solved Minigames, found clues and Red_String links.
2. WHEN the player chooses Retry from morning, THE System SHALL return to the start of the current Stage's day with the full-health and 60% lantern oil rules of spec 09.
3. WHEN the player chooses Continue, THE System SHALL rebuild the Stage, the Case_Store, the Curse_Meter, the Altar_Lock remainder, the wrong-answer count, the hint tiers used and Doubt from the save.
4. WHEN the player starts a New Game, THE System SHALL reset every Stage and Case field to its initial value.
5. WHEN a Stage ends, THE System SHALL move its solved Case into the Closed cases list and SHALL replace the active clue set with the next Stage's set.
6. FOR ALL valid Case_Store states, saving then loading SHALL produce an equal state (round trip).
7. IF a save made before spec 10 is loaded, THEN THE System SHALL map the old night number to a Stage and open a Stage-1 Case without error.

### Requirement 5: Dev mode for stages (E1)

**User Story:** As a developer, I want to jump to any stage and solve the case from the Dev_Panel, so that I can test late content in seconds.

#### Acceptance Criteria

1. THE Dev_Panel SHALL offer "Skip to stage 1", "Skip to stage 2" and "Skip to stage 3".
2. THE Dev_Panel SHALL offer "Solve current case", which performs the real solve action through the Case_Store and Stage_System.
3. THE Dev_Panel SHALL offer "Give all clues of the current case" and "Solve current minigame".
4. WHEN "Skip to stage N" is used, THE Dev_Panel SHALL grant the key items and unlock the recipes a player would hold at the start of that Stage.
5. THE Debug_Hook SHALL expose `caseState()` and `stageState()` returning JSON-safe copies of the Case_Store and Stage_System state.
6. THE System SHALL keep all stage dev code in `src/dev/` and reach the game only through the existing stores and the `devCheats` paths.
7. The Real_Input_Test of Requirement 30 SHALL NOT use any skip or solve action from the Dev_Panel.

### Requirement 6: Scares, objectives and compass for stages (E1)

**User Story:** As a player, I want the tracker, compass and scares to follow the stage design, so that I always know what to do next and no scare ambushes a puzzle.

#### Acceptance Criteria

1. WHILE the phase is day, THE Scare_Director SHALL replace a rolled `lurker-lunge` with `door-slam`.
2. WHILE a Minigame overlay, the satchel, crafting or pause is open, THE Scare_Director SHALL begin no scare.
3. WHILE the journal is open at night, THE Scare_Director SHALL begin no scare.
4. WHILE the phase is night and the Case is unsolved, THE Objective_Tracker SHALL show "The curse holds. Solve the case at the altar." with "Curse 7 / 10" (number and bar) on the second line.
5. WHILE the phase is day, THE Objective_Tracker SHALL show the first unsolved Minigame or missing key of the current Stage's Case, as listed in docs/game-design.md §11.
6. WHEN every Minigame of the Case is solved, THE Objective_Tracker SHALL show "Solve the case: <title>, clues N/M".
7. THE compass objective marker SHALL point to the next Minigame's place by day and to the Altar at night.
8. THE first Minigame (Stage 1, 1a) SHALL be reachable from the hut within 3 minutes of pressing Begin.
9. THE Scare_Director SHALL keep the 45 s major and 15 s minor cooldowns, the first mild scare within 3 minutes, and the base chances unchanged.

### Requirement 7: Case data and reachability (E2)

**User Story:** As a player, I want every answer to follow from clues I can find, so that no case needs outside knowledge.

#### Acceptance Criteria

1. THE Case data in `src/data/cases.ts` SHALL define for each Case 6 to 8 clues, at least 2 of them red herrings, the Deduction_Notes, the Final_Question slots with their options, the answer, the three Hint_Tiers and the Closed-case page of 3 to 5 sentences.
2. FOR ALL Cases, every clue needed by the correct answer SHALL be obtainable in that Stage by walking, examining, solving a Minigame of the same Stage, or buying with the player's first purchase (reachability).
3. WHEN a Stage starts, THE Case_Store SHALL show only that Stage's clue set on the Case_Board.
4. THE Case data SHALL give every clue a unique kebab-case id typed as a union, and every Deduction_Note SHALL reference two existing clue ids.
5. THE Closed-case pages SHALL describe the real history (safety coffins, body snatching and mortsafes, the church's role in catacombs) in a respectful, non-gory tone.
6. A data test SHALL fail when a clue id is duplicated, a note references a missing clue, or an answer option list lacks the correct option.

### Requirement 8: Case board (E3)

**User Story:** As a player, I want a cork board of clues I can connect, so that deducing feels like detective work.

#### Acceptance Criteria

1. THE Case_Board SHALL appear as the journal tab "Case" with clue cards pinned on a cork texture in the parchment, ink and ember tokens of the visual style guide.
2. WHEN a clue is found, THE Case_Board SHALL pin its Clue_Card; THE Case_Board SHALL NOT pin cards for clues not yet found and SHALL NOT solve links on its own.
3. WHEN the player drags from one Clue_Card to another with the mouse, THE Case_Board SHALL draw a Red_String between them.
4. WHEN the player selects a Clue_Card, selects a second card and presses Enter, THE Case_Board SHALL draw the same Red_String as a drag would.
5. IF a Red_String joins two cards that belong together, THEN THE Case_Board SHALL show the Deduction_Note and lower the Curse_Meter by one step.
6. IF a Red_String joins two cards that do not belong together, THEN THE Case_Board SHALL show no note, SHALL leave the Curse_Meter unchanged and SHALL cost nothing.
7. WHEN a link is made twice, THE Case_Board SHALL change nothing the second time (idempotent).
8. THE Case_Board SHALL show the Final_Question with slots that the player fills from options by mouse or keyboard.
9. THE Case_Board SHALL be fully operable with the keyboard, show a visible focus state on every card and slot, and announce each new note as text.
10. THE Case_Board SHALL use real text in the plain-font setting, SHALL not rely on colour alone to show a linked pair, and SHALL honour reduced motion with fades instead of slides.
11. A Real_Input_Test SHALL open the board, drag one string with the mouse and make another by keyboard, and assert both notes appear.
12. THE System SHALL save a Screenshot_Pair of the Case_Board with 5 or more cards, 2 strings and a filled note.

### Requirement 9: Hints, Doubt, Sharp Eye (E2, E3)

**User Story:** As a player, I want paid hints and fair penalties, so that I can get unstuck and still feel clever when I do not.

#### Acceptance Criteria

1. THE Case_System SHALL reveal Hint_Tier 1, 2 and 3 strictly in that order, costing 5, 10 and 20 Grave Coins.
2. IF the player has too few Grave Coins, THEN THE Case_System SHALL refuse the hint and keep the coins.
3. WHILE the mode is a Story mode and the night has run 3 minutes, THE Case_System SHALL give Hint_Tier 3 free.
4. WHEN a wrong answer is given in a day Minigame, THE Case_System SHALL add 1 Doubt, capped at +3 a night, and subtract 50 score.
5. WHEN a night starts, THE Wave_Director SHALL add one Shambler to the first wave for each Doubt point (at most 3).
6. WHEN a Case is solved with no hint used and no wrong answer given (day or altar), THE Case_System SHALL award 300 score as Sharp_Eye.
7. WHEN all 3 Cases are solved with no hint used, THE System SHALL unlock the achievement Case_Closed.
8. THE Case_Board SHALL show each Hint_Tier's price, whether it is locked, and what has been revealed, in text.
9. Using any hint SHALL forfeit Sharp_Eye for that Case.

### Requirement 10: Journal at day and night, Closed cases (F8)

**User Story:** As a player, I want to study the board by day without risk and feel pressure at night, so that the night keeps its tension.

#### Acceptance Criteria

1. WHILE the phase is day, THE journal SHALL pause the simulation when open.
2. WHILE the phase is dusk or night, THE journal SHALL leave the simulation running, dim the screen and keep sounds playing.
3. WHEN a Case is solved, THE journal SHALL move it to the "Closed cases" tab with its history page.
4. THE journal SHALL list Closed cases as read-only and SHALL keep them after Continue.
5. WHEN the Case tab is opened for the first time on day 1, THE tutorial SHALL mark step "Opening the Case tab on the journal" done.
6. THE journal at night SHALL be reachable and closable by keyboard and SHALL still let Esc open pause.

### Requirement 11: Minigame rules (case-design §5)

**User Story:** As a player, I want every puzzle to work the same way and be readable, so that I never fight the interface.

#### Acceptance Criteria

1. THE Minigame_Shell SHALL present each Minigame as its own overlay that counts in `isMenuOpen()` so that Cursor_Release frees the mouse and takes it back on close.
2. THE Minigame_Shell SHALL run no timer by day.
3. THE Minigame_Shell SHALL be fully operable with the keyboard, with a visible focus state, Esc to close, and Tab order that follows the reading order.
4. THE Minigame_Shell SHALL use real text, honour the plain-font setting, never convey a result by colour alone (each result adds a glyph and text) and show a caption for every sound.
5. WHILE a Minigame overlay is open, THE Scare_Director SHALL begin no scare.
6. THE Minigame answers SHALL live in `src/data/cases.ts` and the rules SHALL be pure functions in `src/game/systems/case*.ts`.
7. WHEN a Minigame is closed without an answer, THE Case_Store SHALL keep partial progress (placed tiles, drawn lines, ordered cards).
8. IF the player gives a wrong answer in a Minigame by day, THEN THE Case_System SHALL apply Doubt (Requirement 9.4) and SHALL show a short in-world message without a scare.
9. THE new Minigame props (bell posts, plaster casts, letter tiles, hymn board, hasp pin, name tablets) SHALL be simple meshes that clear the gameplay anchors and waypoint edges and add no lights.

### Requirement 12: Minigame 1a, Ledger Cross-check (Stage 1)

**User Story:** As a player, I want to compare the parish ledger with the gravestones, so that I can find which burials do not add up.

#### Acceptance Criteria

1. THE Minigame 1a SHALL show a two-page spread: the ledger of 8 entries (date, plot, cause, doctor) on the left and the rubbings of the readable stones (Marsh, Hale, Ames, Pell and 2 more) on the right.
2. WHEN the player draws a line from a stone to a ledger entry and flags a mismatch of date, plot or missing certificate, THE Case_System SHALL check the flag against the data.
3. WHEN the player has set 3 correct flags, THE Case_System SHALL mark 1a solved, narrow the Case to 3 candidate graves and pin the resulting Clue_Cards.
4. IF the player sets a wrong flag, THEN THE Case_System SHALL reject it, add Doubt and show the message "These two agree".
5. THE Minigame 1a SHALL be playable by keyboard alone: arrow keys to move between stones and entries, Enter to join, F to flag.
6. THE hut shelf SHALL hold the ledger page so that 1a starts from the hut.
7. A Real_Input_Test SHALL solve 1a by mouse drags and clicks, then assert the 3 candidate graves are marked and the objective changes to the bells.
8. THE System SHALL save a Screenshot_Pair of 1a with 2 lines drawn.

### Requirement 13: Minigame 1b, The Bells (Stage 1)

**User Story:** As a player, I want to examine the safety-bell posts of the candidate graves, so that I can see which burial went wrong.

#### Acceptance Criteria

1. THE Minigame 1b SHALL place a safety-bell post at each of the 3 candidate graves, each with an examine view that lets the player turn the bell, inspect the rope and read the tag.
2. WHEN the player has examined all three posts, THE Case_System SHALL pin the Clue_Cards for the cut rope, the rusted bell and the tag dated a day before the ledger's death date.
3. THE Case_System SHALL provide the red herrings "fresh flowers on Hale" and "toppled Marsh stone".
4. IF the player marks the wrong post as the answer to "Which bell was cut?", THEN THE Case_System SHALL reject it, add Doubt and show a message.
5. THE Minigame 1b SHALL be playable by keyboard alone: arrow keys turn the view, Enter inspects, Tab changes post.
6. THE bell posts SHALL be placed only after 1a is solved and SHALL be simple meshes.
7. A Real_Input_Test SHALL walk to the three posts, examine each with the mouse and keyboard, and assert the three cards appear.
8. THE System SHALL save a Screenshot_Pair of one examine view.

### Requirement 14: Case 1 final answer and reward (Stage 1)

**User Story:** As a player, I want to accuse the right grave at the altar and be rewarded, so that I feel the case close.

#### Acceptance Criteria

1. THE Final_Question of Case 1 SHALL read "The one buried alive lies in ___ because ___." with slots for the grave and the reason.
2. WHEN the player answers "Pell's grave" with "the bell rope was cut and the certificate was signed before the death", THE Case_System SHALL accept it as correct.
3. FOR ALL other combinations of grave and reason options, THE Case_System SHALL reject the answer.
4. WHEN Case 1 is solved, THE System SHALL place the Rusted Crypt Key in Pell's grave, mark the dig mound and open the Mausoleum Row gate for Stage 2.
5. WHEN the player makes the first purchase in Stage 1, THE merchant SHALL hand over the Vane & Sons receipt as a key clue for Case 3.
6. THE Case_Board SHALL be fillable with the Case 1 answer by keyboard alone.
7. A Real_Input_Test SHALL give the right answer at the altar at night with mouse and keyboard and assert the waves stop and the sunrise plays, and SHALL give a wrong answer and assert the 30 s lock and the instant wave.
8. THE System SHALL save a Screenshot_Pair of the altar answer panel.

### Requirement 15: Minigame 3a, The Hymn Board (Stage 3)

**User Story:** As a player, I want to decode the hymn board, so that the stair behind the altar opens.

#### Acceptance Criteria

1. THE Minigame 3a SHALL show the board numbers 4, 19, 2, 41 and 23, the psalter index of hymns 1 to 60 by title, and five brass letter tiles.
2. WHEN the player sets the tiles to the first letters of hymns 4, 19, 2, 41 and 23 (B, E, L, O, W) and blows the whistle at the altar, THE Case_System SHALL mark 3a solved and reveal the hidden stair.
3. IF the player sets any other letters, THEN THE Case_System SHALL reject them, add Doubt and show the message "The tiles do not sit true".
4. THE Minigame 3a SHALL be playable by keyboard alone: arrow keys choose a tile and change its letter, Enter confirms.
5. THE psalter index SHALL be real text on a vestry prop.
6. A Real_Input_Test SHALL read the board, set the five tiles with the mouse and confirm with the keyboard, and assert the stair opens.
7. THE System SHALL save a Screenshot_Pair of 3a with three tiles set.

### Requirement 16: Minigame 3b, Elias's Last Night (Stage 3)

**User Story:** As a player, I want to order the evidence of Elias's last night, so that I understand he was sealed in alive.

#### Acceptance Criteria

1. THE Minigame 3b SHALL present six evidence cards (dry boots, unsent letter, hearse-cart ruts, spilled lantern oil, fingernail marks, iron hearse-pin) and a midnight-to-dawn timeline.
2. WHEN the player places the cards in the correct order, THE Case_System SHALL mark 3b solved, replay the night in captioned beats and open the Crane crypt with the pin pulled.
3. WHEN the crypt opens, THE System SHALL place Elias's body and the Iron Ossuary Key at the crypt.
4. IF the player confirms an incorrect order, THEN THE Case_System SHALL reject it, add Doubt and highlight the first card that is out of place with a glyph and text.
5. THE Minigame 3b SHALL be playable by keyboard alone: arrow keys choose a card, Space lifts it, arrow keys move it, Enter confirms.
6. A Real_Input_Test SHALL collect the six cards by walking, order them by drag, and assert the crypt opens.
7. THE System SHALL save a Screenshot_Pair of 3b with a partial order.

### Requirement 17: The Rite as relic placement (E2)

**User Story:** As a player, I want to place the five relics in the right order, so that finishing the rite takes thought and not only a held key.

#### Acceptance Criteria

1. THE Rite SHALL replace the 45 s Interact hold of `finalRite.ts` and `mystery.ts` with placement of the 5 relics on the Altar in the order given by Crane's confession and Elias's notes.
2. WHEN the player places the first relic, THE Boss_Director SHALL start the 10 s rising clock of Father Crane.
3. IF a relic is placed in the wrong position, THEN THE Altar SHALL return the relic to the satchel, show the subtitle "[a sour note from the altar]" and apply the answer-lock rules of Requirement 3.
4. WHILE Father Crane is alive, THE Rite SHALL hold the placed relics and SHALL NOT complete.
5. WHEN the 5 relics are placed in order and Father Crane has fallen, THE Case_System SHALL mark the Rite complete, lift the curse and end the night.
6. IF the player holds fewer than 5 relics, THEN THE Altar SHALL accept no completion and THE Objective_Tracker SHALL show the relic count R/5.
7. THE Rite SHALL be fully playable by keyboard alone and SHALL treat the rite with respect (no mockery, per the taboos in the horror-design rules).
8. THE Rite SHALL end in the Rest ending only; THE System SHALL retire the Uneasy Peace ending.
9. A Real_Input_Test SHALL place the relics in the right order with mouse and keyboard with god mode off for the placement step, and assert Father Crane rises on the first relic.
10. THE System SHALL save a Screenshot_Pair of the relic placement with 3 relics placed.

### Requirement 18: Silas reveal, Accusation and epilogue (Stage 3)

**User Story:** As a player, I want to learn who really sealed Elias in, so that the story pays off.

#### Acceptance Criteria

1. THE Case data SHALL link the ledger's "same careful hand" to Josiah Vane (flyleaf in the ossuary), the Vane & Sons receipt, Elias's letter naming "the undertaker's family", the hearse-pin and the cart ruts.
2. THE Accusation Final_Question SHALL read "Elias was sealed in by ___. Motive: ___. Means: ___. Opportunity: ___." with options for each slot.
3. WHEN the player gives the correct Accusation (Silas Vane, the handwriting, the hearse-pin, the cart ruts), THE System SHALL add the Justice for Elias epilogue before the Win_Cutscene and award the achievement *Justice for Elias*.
4. IF the Accusation is wrong or not given, THEN THE System SHALL show the line "Silas Vane's cart rolled away at dawn, as it always does."
5. THE Accusation SHALL NOT change whether the run is won.
6. WHILE Stage 3 is before the reveal, THE merchant SHALL trade as normal at every dawn.
7. A Real_Input_Test SHALL give the correct Accusation with mouse and keyboard and assert the epilogue text, and SHALL give a wrong one and assert the default line.
8. THE System SHALL save a Screenshot_Pair of the Accusation panel.

### Requirement 19: Minigame 2a, The Crest Lock (Stage 2)

**User Story:** As a player, I want to open the sexton's niche by ordering crests, so that the whistle is a reward and not a pickup.

#### Acceptance Criteria

1. THE Minigame 2a SHALL show four crest dials at the sexton's niche (−21.2, −52.5), the lodge note "Turn them in the order the founders were laid down", and the years on the 6 crypt name tablets.
2. WHEN the player sets the four dials in the order of the founders' years, THE Case_System SHALL mark 2a solved and give the Sexton's Bone Whistle and the sexton's ledger of night watches.
3. IF the dials are set wrongly, THEN THE Case_System SHALL reject the setting, add Doubt and show "The lock does not give".
4. THE Minigame 2a SHALL be playable by keyboard alone.
5. WHERE this task is cut (cut order 4), THE System SHALL keep the whistle where it is now and the sexton's ledger SHALL be found on the Row without a Minigame.
6. A Real_Input_Test SHALL read the tablets, set the dials with mouse and keyboard, and assert the whistle is given.
7. THE System SHALL save a Screenshot_Pair of 2a.

### Requirement 20: Minigame 2b, The Watch Log (Stage 2)

**User Story:** As a player, I want to put the torn watch-house log in order, so that I find the gap in the watch.

#### Acceptance Criteria

1. THE Minigame 2b SHALL present 8 scattered log entries at the lodge.
2. WHEN the player orders the 8 entries by time, THE Case_System SHALL mark 2b solved, reveal a 2-hour gap on the night the Ames grave was robbed and show whose watch it was.
3. IF the player confirms an incorrect order, THEN THE Case_System SHALL reject it, add Doubt and mark the first misplaced entry with a glyph and text.
4. THE Minigame 2b SHALL be playable by keyboard alone: arrow keys choose an entry, Space lifts it, arrow keys move it, Enter confirms.
5. A Real_Input_Test SHALL order the entries by drag and assert the gap clue appears.
6. THE System SHALL save a Screenshot_Pair of 2b.

### Requirement 21: Minigame 2c, Boot Prints (Stage 2)

**User Story:** As a player, I want to compare plaster casts with the suspects' boots, so that one suspect is placed at the grave.

#### Acceptance Criteria

1. THE Minigame 2c SHALL show 3 plaster casts at the Ames grave and examine views of the 4 suspects' boots, comparing tread, size and hobnail pattern.
2. WHEN the player pairs a cast with the matching boots, THE Case_System SHALL mark 2c solved and pin the matching-boots Clue_Card.
3. IF the player pairs a cast with a wrong boot, THEN THE Case_System SHALL reject it, add Doubt and show a message.
4. THE Minigame 2c SHALL be playable by keyboard alone.
5. WHERE this task is cut (cut order 3), THE Case data SHALL supply the boots clue as a found item so that the Case remains solvable.
6. A Real_Input_Test SHALL pair the correct cast and boots with mouse and keyboard and assert the card appears.
7. THE System SHALL save a Screenshot_Pair of 2c.

### Requirement 22: Case 2 final answer (Stage 2)

**User Story:** As a player, I want to name the body-snatcher with motive, means and opportunity, so that the case is solved by reasoning.

#### Acceptance Criteria

1. THE Final_Question of Case 2 SHALL read "The bodies were sold by ___. Motive: ___. Means: ___. Opportunity: ___." with options drawn from the 4 suspects and their clues.
2. WHEN the player answers the lodge keeper, the surgeon's receipt, the matching boots and the gap in his watch, THE Case_System SHALL accept it as correct.
3. FOR ALL other combinations of options, THE Case_System SHALL reject the answer.
4. THE Case 2 clue set SHALL include the red herrings "spade with fresh clay" and "doctor's anatomy school letter".
5. WHEN Case 2 is solved, THE System SHALL carry the whistle and the hidden stair into Stage 3.
6. A Real_Input_Test SHALL give the right and a wrong answer at the altar with mouse and keyboard and assert the matching outcomes.
7. THE System SHALL save a Screenshot_Pair of the Case 2 board with the answer filled.

### Requirement 23: Win cutscene (E5)

**User Story:** As a player, I want a quiet walk out of the cemetery at sunrise, so that winning feels like release.

#### Acceptance Criteria

1. WHEN the Stage 3 sunrise ends, THE System SHALL play the Win_Cutscene of 15 to 20 s: the keeper walks the main path and out of the gates while the sun rises and the fog lifts.
2. THE Win_Cutscene SHALL reuse the ending camera system (`cameraPath.ts`, `endingSequence.ts`).
3. WHEN the player presses Space or Enter, THE System SHALL skip the Win_Cutscene to the ending card and run summary.
4. WHEN the player presses Esc, THE System SHALL open pause.
5. WHERE `prefers-reduced-motion` is set or Camera shake is off, THE Win_Cutscene SHALL use slow fades and steady dollies with no bob or sway.
6. THE Win_Cutscene SHALL show captions for every sound.
7. WHEN the Accusation was correct, THE Win_Cutscene SHALL show the Justice for Elias epilogue before the walk.
8. A Real_Input_Test SHALL play the cutscene to the end in one run and skip it in another, and SHALL assert the ending card in both.
9. THE System SHALL save a Screenshot_Pair of the cutscene's gate shot.

### Requirement 24: Help for stuck players and judges (E11)

**User Story:** As a judge, I want hints and a short mode, so that I can see the whole game in about 15 minutes.

#### Acceptance Criteria

1. WHILE the phase is day and no new clue has been found for 2 minutes of play, THE lantern flame SHALL lean toward the nearest unfound clue.
2. THE lean SHALL be a change of shape and not a flash and SHALL obey head bob and reduced motion.
3. THE dawn card SHALL show "Clues found N/M" for the next Case.
4. WHERE Short_Vigil is selected, THE System SHALL run 3 Stages with 2-minute days and 100% starting oil, with Minigame rules, hints and Cases unchanged.
5. THE difficulty screen SHALL offer Short_Vigil as a Story option, reachable by keyboard.
6. THE tutorial SHALL add a step "Opening the Case tab on the journal" after step 7 on day 1.
7. A Real_Input_Test SHALL check that a new game in Short_Vigil reaches the first Minigame within 3 minutes of pressing Begin and SHALL log the time.
8. THE System SHALL save a Screenshot_Pair of the dawn card with the clue count.

### Requirement 25: Grab Kill-Cam (E7)

**User Story:** As a player, I want a rare, readable grab scare, so that the worst moments feel earned and never cheap.

#### Acceptance Criteria

1. WHEN a Brute, Lurker or Sprinter reaches the player while health is below 25% or stamina is 0 and the player is not facing it, THE Kill_Cam SHALL pull the camera to face the zombie for 1.2 s, then release the player with damage.
2. THE Kill_Cam SHALL start at most once every 60 s.
3. WHERE Scare intensity is Full, THE Kill_Cam SHALL play the full close-up, stinger and shake.
4. WHERE Scare intensity is Reduced, THE Kill_Cam SHALL play a shorter, quieter version with no shake.
5. WHERE Scare intensity is Off, THE Kill_Cam SHALL not move the camera and SHALL show a red edge flash and the subtitle "[something seizes you]".
6. WHERE Flashing lights is Off, THE Kill_Cam SHALL replace the flash with a steady edge.
7. IF the grab's damage is lethal, THEN THE Kill_Cam SHALL play the full close-up before the death screen, and a scare SHALL NOT be the sole cause of death.
8. THE Kill_Cam SHALL show silhouette, sound and dust only, with no gore.
9. A Real_Input_Test SHALL trigger the grab with a zombie near a low-health player at each intensity and assert the camera, subtitle and cooldown.

### Requirement 26: Stamina by stage and difficulty (E9, cuttable)

**User Story:** As a player, I want the later stages to tire me faster, so that the pressure rises with the story.

#### Acceptance Criteria

1. THE stamina system SHALL set max stamina to 100, 90 and 80 in Stages 1, 2 and 3 (Endless uses 100).
2. THE stamina system SHALL multiply sprint drain by 0.8 on Easy, 1 on Normal and 1.2 on Hard (Endless uses 1).
3. THE stamina system SHALL never let stamina exceed the current cap and SHALL lower current stamina to the cap when the cap shrinks.
4. THE stamina system SHALL never raise the cap between Stages.
5. THE stamina bar SHALL show the cap as a number and in the bar's length.
6. A Real_Input_Test SHALL sprint in two Stages and assert the displayed cap.

### Requirement 27: Tiered crafting (E4, cuttable)

**User Story:** As a player, I want crafting to grow with the stages, so that late weapons feel earned.

#### Acceptance Criteria

1. THE recipe book SHALL group recipes into Tier 1 (Stage 1), Tier 2 (Stage 2) and Tier 3 (Stage 3) as in docs/game-design.md §5.
2. THE Tier 2 recipes SHALL require a crafted component plus 5 to 7 materials and THE Tier 3 recipes SHALL require a blueprint pieced together from 2 clues plus a rare material.
3. FOR ALL pairs of tiers, THE recipe data SHALL give the higher tier a higher damage and a higher total material cost (property).
4. THE recipe book SHALL show each recipe's tier and any missing component.
5. WHERE this task is cut (cut order 2), THE flat recipes of spec 03 SHALL stand, unlocked at the Stage dawns of Requirement 1.7.
6. A Real_Input_Test SHALL craft a component then a Tier 2 weapon at the workbench.

### Requirement 28: Name the Dead (cuttable)

**User Story:** As a player, I want a small puzzle inside the fight, so that night is more than holding a weapon.

#### Acceptance Criteria

1. WHILE a night in Stage 2 or 3 is running, THE Wave_Director SHALL make one opening grave per wave glow and show a name.
2. WHEN the player holds Interact for 3 s at a glowing grave whose name is in the Case's evidence, THE System SHALL speak the name, seal the grave for that wave and add 100 score.
3. IF the player takes damage during the hold, THEN THE System SHALL cancel the hold.
4. IF the name is not in the evidence, THEN THE System SHALL show "You don't know who lies here." and not seal the grave.
5. THE grave SHALL glow with a rune icon and a text label, not by colour alone, and the hold SHALL have a caption.
6. A Real_Input_Test SHALL seal one grave with a held key and assert the score.

### Requirement 29: Accessibility and screenshot rules for every screen

**User Story:** As a player with comfort needs, I want every new screen to follow the accessibility rules, so that the cases are playable for me.

#### Acceptance Criteria

1. THE Case_Board, every Minigame, the Altar panel, the Win_Cutscene and the Kill_Cam SHALL obey the Flashing lights, Camera shake, Scare intensity, Subtitles, Plain font and reduced-motion settings.
2. THE new screens SHALL convey information with glyph and text and not by colour alone.
3. THE new screens SHALL support keyboard navigation with visible focus.
4. Every sound added by this spec SHALL have a subtitle in `src/data/captions.ts`.
5. THE System SHALL save a Screenshot_Pair for every Minigame and for the Case_Board, the altar panel, the dawn card and the Win_Cutscene, in `e2e/screenshots/`.
6. THE new content SHALL stay within the performance budget (fewer than 150 draw calls, at most 4 shadow-casting lights, no new lights for props).

### Requirement 30: Full automated playthrough (spec 09 task 3 moved here)

**User Story:** As a developer, I want one browser test that plays the whole game in Short Vigil, so that a broken step is caught before a deploy.

#### Acceptance Criteria

1. A Playwright test SHALL start a new game in Short_Vigil and play all 3 Stages to the ending card using only `page.mouse` and `page.keyboard`.
2. THE test SHALL use no Dev_Panel action, no teleport and no skip, except god mode to keep the fight fair.
3. THE test SHALL assert the Objective_Tracker text at each step and that the ending card appears.
4. THE test SHALL log the time to the first Minigame and the total run time.
5. THE spec 09 task 3 SHALL carry the note "moved to spec 10 final task" and SHALL NOT be marked done.

### Requirement 31: Stretch items not scheduled

**User Story:** As the project owner, I want the stretch features named and fenced off, so that they do not creep into the schedule.

#### Acceptance Criteria

1. THE System SHALL NOT schedule E6 (new enemies), E8 (extra scares) or E10 (sanctuary health) in this spec.
2. IF E6, E8 or E10 is built later, THEN each SHALL follow its section in docs/game-design.md and add its sounds to the captions and its elements to the Dev_Panel.
