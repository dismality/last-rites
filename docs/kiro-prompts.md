# Last Rites: prompts for Kiro

Paste these into Kiro one at a time, or ask Kiro to turn a section into a spec (for example: *"Create a spec called 09-playtest-fixes from the prompts below"*).

They come from a playtest of https://last-rites.vercel.app on 2026-11-10 and a check of the repo against the Kiroween rules.

**Suggested order:**
1. **Build developer mode first (Part A).** Every later test runs much faster with it.
2. **Fix the blockers (Part B, P0).** Then redeploy.
3. **Run the test prompts (Part D)** to find the rest of the issues.
4. **Fix P1 and P2** issues, then do the submission tidy-up (Part C).

---

## Part A: Developer mode (do this first)

### A1. Developer mode
> Add a developer mode to Last Rites for playtesting. It must be impossible to reach in a normal play-through: enable it only with the URL parameter `?dev=1` or when `import.meta.env.DEV` is true, and never show it in the Settings menu.
>
> When enabled, the backquote key (`) opens a small dev panel styled like the existing parchment UI. It should offer:
> - **Teleport** to named points: hut, chapel altar, workbench, crypt key spot (-12,-18), Mausoleum Row entrance, whistle (-21,-48), Crane crypt, catacomb stair, each relic location, each of the 3 diggable graves, and each scare zone. Add a "teleport to current objective" button.
> - **Time controls:** jump to dawn, midday, dusk, and night start; set day/night speed to 1x, 5x or 20x; skip to night N (1–5).
> - **Wave controls:** spawn a wave now, kill all zombies, spawn one zombie of each type (including the Lurker and elites), spawn Father Crane.
> - **Player cheats:** god mode, infinite oil, infinite stamina, noclip (fly through walls), refill health and oil.
> - **Give items:** any material in any amount, any crafted weapon, any key item, relic or journal page. Add a "give everything" button.
> - **Progress shortcuts:** complete the current objective, unlock all recipes, set chapel repairs to any level, trigger any scare by id, trigger each ending.
> - **Debug views:** show collider wireframes (sensors drawn in a different colour from solid colliders), show the FPS and draw-call count, and print the player's position and current objective id on screen.
>
> Keep the dev code in its own folder (`src/dev/`) so it is tree-shaken out of production builds unless `?dev=1` is used, and add a steering note in `.kiro/steering/structure.md` describing it. Add a unit test that the dev panel cannot open without the flag.

### A2. Automated playthrough test
> Using the developer mode hooks, write a Playwright e2e test that plays the main story path quickly:
> 1. Start a new game and skip the intro.
> 2. Read page 1, then walk (not teleport) to the crypt key and pick it up.
> 3. Teleport to Mausoleum Row and walk down the alley to the whistle.
> 4. Blow it at the altar, get the ossuary key, and collect all 5 relics.
> 5. Finish the rite and defeat Father Crane with god mode on.
>
> Assert that the objective tracker text changes at each step and that an ending screen appears. Walking (not teleporting) into each item spawn checks that nothing invisible blocks the player.

---

## Part B: Bug fixes

### P0: blocks progress

**B1. Invisible scare boxes block the player** (the game can't be finished)
> In `src/scene/player/FirstPersonController.tsx`, `kcc.computeColliderMovement` is called without filter flags, so the Rapier character controller collides with the scare-zone *sensor* colliders from `ScareZoneVolumes.tsx`.
>
> As a result, the player can't enter any scare zone. That makes these unreachable:
> - the Rusted Crypt Key (-12,-18) in `grounds-oak-path`
> - the Bone Whistle, Iron Ossuary Key, page 3, ledger and Crane's Rosary in the Mausoleum Row alley zones
> - the Child's Locket in `grounds-west-hill`
> - page 4, the Burial Shroud and the Reliquary Heart in the catacomb zones
>
> Pass `rapier.QueryFilterFlags.EXCLUDE_SENSORS` as the third argument (use `useRapier()`), the same way `wallProbe.ts` and `shotOcclusion.ts` already do. Add a Playwright test that walks the player into every scare zone and checks that the zone's scare can fire.

**B2. Retry Night can trap the player in a death loop**
> When the player dies and picks Retry Night, they restart at dusk with only ~27 s, the same low oil (39% in my test) and no weapons, so they can die over and over. Make retry restore a fair loadout: at least 60% oil and full health. Add a "Retry from morning" option. Add a property test that a retried night never starts with less than 60% oil.

### P1: most players will hit these

**B3. Too little oil on day 1**
> The lantern drains 1% every 6 s by day and every 3 s at night (`src/data/balance.ts`), so a 6-minute day burns ~60% of the oil before night 1. Stop the lantern draining in daylight (or halve the day rate), and place an oil pickup on the day-1 objective path. Keep `balance.ts` and `docs/game-design.md` in sync so the data-matches-design-bible hook passes.

**B4. The oil on the hut table can't be picked up, and the tutorial step is skipped**
> In the hut, the oil bottle on the side table shows no "E" prompt even with the crosshair on it, so it can't be picked up. The tutorial step "pick up the oil on the shelf" (`tutorialSteps.ts` step 2) never appears: after reading page 1 the objective jumps straight to the crypt key.
>
> Make the bottle a real pickup (check the `hut-shelf` spawn point at [1.8, 0.8, -1] and its `hut-supplies` loot table) and make picking it up a required tutorial step. Add a test for the tutorial step order.

**B5. Spawn faces the wrong thing**
> At spawn the camera faces the workbench, but objective 1 is the page on the side table. Turn the spawn yaw toward the side table, and change the intro card from "on the shelf" to "on the table".

**B6. The compass points through the hut wall**
> After page 1, the compass objective marker points straight through the hut's back wall, and nothing points to the door. While the player is inside the hut and the objective is outside, point the marker at the hut door, or add a "Leave the hut" objective step.

**B7. The examined journal page is blank**
> In the examine overlay, journal pages render as a blank brown slab, so "Read the page" shows nothing to read. Put the page's handwritten text on the 3D page as a canvas texture, or show the text in the examine panel.

**B8. Lantern glare blinds the player near walls**
> Standing near a wall, the lantern light whites out most of the screen. Clamp the lantern intensity by distance to the nearest surface, or soften the falloff, so walls stay readable at 0.5 m.

**B9. The workbench recipe book shows icons only**
> The workbench recipe book shows icons with "×3, missing 3" but no recipe or ingredient names. The name only appears on hover, and that tooltip shows in the middle of the screen rather than next to the cursor. Show each recipe's name and each ingredient's name and count on the card. Anchor the tooltip to the hovered item, and make it disappear when the workbench closes (it stays in the page after closing now).

**B10. A demo mode for judges**
> A full run is 5 days × (6-minute day + dusk + night), which is 45+ minutes, so judges won't reach the boss or an ending. Add a "Short Vigil" mode on the difficulty screen: 2-minute days, 3 nights, 100% starting oil and a basic weapon, so a run with an ending fits in about 15 minutes.

### P2: polish

**B11. The movement hint lingers**
> The "W A S D to move, mouse to look" hint stays through the whole first objective. Clear it once the player has moved 2 m and turned the camera.

**B12. The HUD breaks in narrow windows**
> Below 900 px wide, the health bar runs under hotbar slot 1 and its "100 / 100" label covers the shovel icon, and the objective panel shrinks to a few characters wide. Make the HUD responsive and add a Playwright screenshot test at 800x600.

**B13. The difficulty screen hides Begin**
> At 800 px tall, the Begin button is below the fold inside a scroll box with no hint to scroll. Pin Begin and Back to the bottom of the panel, or make the cards more compact.

**B14. The journal handwriting is hard to read**
> The handwritten journal font is beautiful but small and slow to read. Increase its size and line spacing, and add a "plain font for journal" option in Settings (in line with the accessibility steering doc).

**B15. The intro is long**
> The intro cutscene runs about 35 s. Trim it to about 20 s, keeping the fog flyover and the hut card.

**B16. Quit to Title has no confirmation**
> "Quit to Title" in the pause menu quits immediately without a confirmation, and the title screen has no Continue option, so one mis-click loses the run. Add a confirmation dialog, and a Continue button on the title screen if a save exists.

**B17. Dead code**
> `src/scene/world/useWorkbench.ts` is never called anywhere; the workbench opens through the Interactable instead. Delete it, or wire it up if it was meant to replace the Interactable.

---

## Part C: Submission tidy-up

**C1. README links**
> In README.md, replace `YOUR-DEPLOY-URL` with https://last-rites.vercel.app and `YOUR-VIDEO` with the YouTube link once it's uploaded. Add a screenshot at the top.

**C2. Dev log dates**
> In `docs/kiro-log.md`, 18 entries are dated 14–24 November 2026, which is after the day they were written, and one is dated 2026-02-05, before the 30 October 2026 start of the hackathon. Correct every entry to the real date it was written, using the git history as the reference.

**C3. Submission kit**
> Update `docs/submission-kit.md` for the current state: there are 8 specs, not 5. Fill in the "How Kiro was used" outline from `docs/kiro-log.md`, with concrete examples:
> - the scare-sensor bug and the test that now guards it
> - the fast-check NaN dt finding
> - the context7 catches (rapier `kinematicPosition`, R3F v9 render priority)
>
> Add sections for developer mode and any Kiro CLI, Web, Crew, powers or custom agents used.

---

## Part E: The new vision (3 curse stages, puzzles, crime stories)

**Do this after the P0/P1 fixes in Part B.** It's a big redesign, and the deadline is 4 December, so it's split into a must-have core (E1–E5) and extras (E6–E11). Start with E0: Kiro updates the design bible first, because every other spec and hook treats `docs/game-design.md` as the source of truth.

### What's already in the game (keep it)
| Your idea | Status |
|---|---|
| A keeper who isn't the first, and a document on the table that explains the curse | ✅ Elias's journal page 1 in the hut |
| Clues all over the graveyard | ✅ 20+ clues (tombstones, examined props, the ledger) in the journal's Clues tab |
| Weapons crafted from graveyard materials | ✅ Workbench, 12 recipes, unlocked over the nights |
| Zombies attack the sanctuary if you hide in it, otherwise chase you | ✅ Chapel doors with boards (60 HP each). Zombies attack them while you're inside, and 1 in 3 go for the doors anyway |
| Different zombies: speed, defence/HP, a boss | ✅ Lurker (6 m/s lunge), Brute (300 HP), Bloater (bursts), Wailer (calls others), elites, and Father Crane as the boss |
| Jump scares with sound | ✅ A scare director with 8 telegraphed scares (statue turn, breath behind you, hand from the grave…) and comfort settings |
| Sprint with a stamina bar | ✅ 100 stamina, drains 20/s |
| No zombies by day, sunrise after the night | ✅ Mostly. Lurkers can still appear by day in Mausoleum Row and the catacombs |
| An ending cutscene | ✅ An ending camera and 3 endings (Rest, Uneasy Peace, Taken) |

### What's different or missing
| Your idea | Now | Gap |
|---|---|---|
| **3 stages** | 5 nights | Change to 3 stages |
| **The sun doesn't rise until you solve the stage's puzzle; waves never end until then** | Night ends when its fixed waves are cleared | The night's end condition must change |
| **A puzzle per stage that you actually solve** | Clues are collected but never *used*. There's no answer to give | Add a deduction puzzle with an answer |
| **Clues reset and change each stage** | One fixed set of clues | Clue sets per stage |
| **Each stage's story teaches a crime or horror story** | One story (Father Crane, 1849) | Make each stage a "case" |
| **Unavoidable close-up of a zombie eating you, for some zombies** | Nothing | Add a grab "kill-cam" |
| **Ranged zombies; ghosts, witches and other entities** | No ranged attacks, no ghosts | New enemy types |
| **Stronger weapons need more materials and more thought** | Recipes are cheap and flat (2–5 items) | Tiered recipes |
| **Stamina gets lower as difficulty rises** | Stamina is the same in every mode | Scale it by stage and difficulty |
| **Win cutscene: you leave the graveyard at sunrise** | Ending camera, but not that scene | Add a walk-out scene |
| **Sanctuary durability** | The doors have boards; the building itself can't break | Optional: a sanctuary health bar |

### E0. Update the design bible first
> We're changing the game's structure. Before any code, update `docs/game-design.md` (the design bible) and the steering docs to this design, then show me the diff for approval:
>
> **Core loop:** 3 stages instead of 5 nights. Each stage is one day plus one night.
> - **Day:** no zombies anywhere, including Lurkers. The player explores, gathers materials, crafts and collects that stage's clues.
> - **Night:** the curse holds back the sun. Waves never end, and each wave is harder than the last, until the player solves the stage's puzzle at the chapel altar.
> - **Solving:** a correct answer lifts that stage's curse. The waves stop, the remaining zombies collapse, and a sunrise plays. A wrong answer costs something (a wave spawns at once and the altar locks for 30 s) but never ends the run.
> - **Next stage:** a new day begins. That stage's clues are replaced by the next stage's set, the next "case", and the journal keeps the solved case in a "Closed cases" tab.
>
> **Win:** clear all 3 stages. The final sunrise plays a cutscene of the keeper walking out of the cemetery gates as the sun comes up.
>
> **Story:** each stage is a case drawn from widely told graveyard crime and horror folklore. Keep the existing Father Crane story as stage 3, the finale, so most of the current content is reused. (See E2 for the cases.)
>
> Also update the endings, objective rules, waves table, recipe unlocks and the scare director for 3 stages. Keep all accessibility rules.

### E1. Curse-gated nights (the core loop)
> Implement the stage loop from the updated design bible, as a new spec `10-curse-stages`:
> - Replace the 5-night structure with 3 stages.
> - Nights spawn waves without end, escalating in size and enemy mix every wave, until the stage puzzle is solved.
> - Show "The curse holds. Solve the case at the altar." in the objective tracker at night.
> - On a correct answer: stop spawning, collapse living zombies with a dust effect, then play dawn and the dawn summary.
> - No Lurkers by day.
>
> Keep the barricades, Retry Night and the dev-mode tools working with stages (dev mode: "skip to stage N", "solve current case"). Add property tests:
> - waves never stop before the case is solved
> - waves always stop after it
> - wave difficulty never decreases within a night

### E2. The cases (true-crime-style puzzles)
> Add a deduction puzzle per stage, built on the existing clue system:
> - Each stage has a "case file" in the journal.
> - Clues found by day fill the case file's slots.
> - At the altar the player gives an answer by choosing from options, for example "Which grave?", "Who did it?", "In what order?".
> - Every answer must be reachable from the clues alone, with no outside knowledge. Use 6–8 clues per case, at least 2 of them red herrings.
> - Optional hints cost Grave Coins.
>
> The cases, all set in 1840s–1890s Hollowmere and based on widely told folklore, with no real modern victims:
> 1. **"Saved by the Bell" (buried alive).** Safety coffins had a bell on a rope so the "dead" could signal. Clues: a bell rope cut at one grave, scratch marks on a coffin lid, a doctor's hurried certificate, a ledger date that doesn't match. Answer: *which grave holds someone buried alive*.
> 2. **"The Resurrection Men" (body snatchers).** Graves robbed for anatomy schools; iron mortsafes and watch-houses built to stop them. Clues: boot prints, a surgeon's receipt, a spade with fresh clay, a watch-house logbook gap. Answer: *which of 4 suspects (the sexton, the doctor, the lodge keeper, the gravedigger) sold the bodies*.
> 3. **"The Sealed Catacombs" (the existing Father Crane story).** Answer: *the correct order of the 5 relics in the rite*, given in Crane's confession and Elias's notes. This replaces the current "hold E for 45 s". Father Crane still rises during it.
>
> Each solved case adds a short "what really happened" journal page (3–5 sentences). That's the educational part: each one explains the real history behind the legend (safety coffins, body snatching, mortsafes).

### E3. Clue board UI (fits the Costume Contest category)
> Add a "Case board" tab to the journal: a cork board with pinned clue cards, connected by red string the player can drag between clues. Linking two clues that belong together reveals a short deduction note, for example "Same handwriting as the ledger". Keep it fully usable by keyboard. This is the puzzle's main interface and should be the most polished screen in the game.

### E4. Tiered crafting
> Rework recipes into 3 tiers, keeping the existing weapons:
> - **Tier 1 (stage 1):** simple, 2–4 common materials (Bone Club, bandages, refills).
> - **Tier 2 (stage 2):** needs a crafted *component* first (for example, an Iron Head from nails and a plank) plus 5–7 materials (Sharpened Shovel, Holy Water Flask, Lantern Trap).
> - **Tier 3 (stage 3):** needs a *blueprint* pieced together from 2 clues plus a rare material (silver filings, grave salt). The player has to work out where the parts are (Silver Sabre upgrade, Nail Bomb, Blessed Rounds).
>
> Damage must rise with tier, and so must the cost (a property test should check this). Update the recipe book to show the tier and any missing component.

### E5. Win cutscene
> At the end of stage 3, after the sunrise, play a 15–20 s skippable cutscene: the keeper walks down the main path and out through the cemetery gates as the sun rises and the fog lifts, then the ending card and summary. Reuse the ending camera system. Respect reduced motion.

### E6. New enemies (ranged, dash, ghost, witch)
> Add 4 enemy types using the existing models with new tints and effects (no new model files), plus audio from the synth system:
> - **Sprinter (stage 1+):** a fast zombie that pauses, then dashes 8 m in a straight line. Telegraph: a short shriek and a lunge pose 0.6 s before. Can be dodged.
> - **Spitter (stage 2+):** keeps 8–12 m away and lobs a grave-bile projectile with a visible arc (15 damage plus a 2 s slow). The projectile can be dodged or blocked by cover.
> - **Wraith (ghost, stage 2+, night only):** floats through walls and gravestones, and is immune to normal weapons. It can only be hurt by holy water, Blessed Rounds or by holding the lantern beam on it for 2 s, which makes it solid. It drains lantern oil when close.
> - **Grave Witch (stage 3, one per night):** stands still and chants. Every 10 s she curses the player (the screen darkens and the controls feel sluggish for 4 s) or raises 2 Shamblers. Killing her ends both effects. Her chant is audible from 40 m and directional.
>
> Add all 4 to the elite rules and the dev panel, with subtitles for every sound.

### E7. Grab "kill-cam" jump scare
> When a Brute, Lurker or Sprinter reaches the player while they're below 25% health, or out of stamina and not facing it, play a grab: the camera is pulled to face the zombie for 1.2 s (face close-up, sound stinger, screen shake), then the player breaks free with damage. If the hit is lethal, it plays the full close-up before the death screen. It must respect the comfort settings:
> - **Full:** the full version.
> - **Reduced:** shorter, quieter stinger, no shake.
> - **Off:** no camera pull; a red edge flash and a subtitle only.
> - **No-flash mode:** no flash.
>
> Keep it non-gory, in line with the horror-design steering doc. At most once every 60 s.

### E8. More scare sounds
> Add to the scare director, each with a telegraph and a subtitle:
> - coffin scratching under the player's feet ("[scratching beneath the soil]")
> - a distant church bell that tolls the wrong number of times
> - a child humming from an empty grave
> - a witch's laugh circling the player
> - knocking from inside a crypt door
> - a ghost sliding across the edge of the screen in the lantern beam
> - the keeper's own name whispered
>
> Keep the cooldown rules, and add each new scare to the scare-accessibility hook's checks.

### E9. Stamina by stage and difficulty
> Scale sprint stamina: max stamina 100 / 90 / 80 by stage, and drain ×0.8 on Easy, ×1 on Normal, ×1.2 on Hard. Show the cap on the stamina bar. Add a property test that stamina never exceeds the cap and the cap never rises between stages.

### E10. Sanctuary health
> Give the chapel itself an overall health bar on top of the door boards: zombies that break in damage the altar area. At 0, the stage restarts from dusk (Retry Night rules). Show it on the HUD only at night, and only after the doors have been barred.

### E11. Help for stuck players and judges
> - **"Keeper's hunch":** if the player hasn't found a new clue in 2 minutes, the lantern flame leans toward the nearest unfound clue.
> - **Case summary:** on the dawn card, show "Clues found 5/8" for the next case.
> - **Short Vigil (B10):** make it 3 stages with 2-minute days, so a full run fits in about 15 minutes for judges.

---

## Part F: Small logic gaps and flow fixes

Found by reading the design bible (`docs/game-design.md`) against my playtest. Each is small on its own; together they decide whether the game feels fair. Items marked **(E)** only apply once the Part E stage redesign is in.

### F1. Day 1 sets the player up for night 1
> Fix the day-1 flow so a new player is never sent into night 1 with only the shovel:
> - **Guaranteed materials.** On day 1 only, the player's first dig always gives at least 3 bone, and the hut always holds at least 1 cloth, so the Bone Club (3 bone, 1 cloth) can be made before dusk.
> - **A "prepare" objective.** If it's day, the player has no weapon except the shovel, and dusk is under 2:00 away, the objective tracker shows "Craft a weapon at the workbench (0/1)" above the story objective.
> - **Clear the tutorial step order.** Step 2 ("pick up the oil") currently finishes on *any* pickup, so it can be skipped. Make it finish only on the oil.

### F2. Dusk and getting home
> - **Warn earlier.** At "Dusk in 1:00", show a one-time card ("The light is going. Get back to the chapel.") and add a ✝ chapel marker with distance to the compass. Thirty seconds of dusk isn't enough to walk back from the end of Mausoleum Row or the catacombs (60–70 m at 3 m/s, if you don't sprint).
> - **End the day early.** Add "Ring the bell to call the night" at the chapel bell. A player who's ready doesn't have to wait out the rest of a 6-minute day.

### F3. The workbench and satchel at night
> - **A bench in the chapel.** The only workbench is in the hut, but the player shelters in the chapel at night, so crafting at night means leaving the safe zone. Add a small "field bench" in the chapel, unlocked by repair stage 2, that can make consumables (bandages, refills, flasks) but not weapons.
> - **A stash.** The satchel has 12 slots, and there are 11 material types plus ammo and crafted items, so it fills by day 2. Add a chest in the hut and one in the chapel that share storage. The workbench should be able to use materials from the stash directly.

### F4. Light, oil and darkness (no death spirals)
> - **No oil drain in daylight.** Day drain should be 0, or a tenth of the night rate (this overlaps B3).
> - **Rethink darkness.** Zombies currently take 50% less damage when the lantern is empty. Combined with scarce oil, a player who runs dry gets weaker *and* blind and can't recover. Replace it with: in darkness, zombies are harder to see and scares are more likely, but damage is unchanged.
> - **A light of last resort.** When oil hits 0, the keeper can still light a match for 10 s (unlimited, but 15 s cooldown) to find their way.

### F5. Saving and losing progress
> - **Autosave at every dawn** and at the start of each dusk, separate from the altar save (which needs repair stage 2). Right now a player who quits before repairing the altar loses everything.
> - **A Continue button** on the title screen whenever a save exists (overlaps B16).
> - **Death keeps knowledge.** On Retry, every clue and journal page found stays found, even if it was picked up after the retry point.

### F6. Weapons and drops
> - **Durability warning.** At 5 hits left, show "Bone Club is cracking" with a subtitle and a crack sound. When it breaks, auto-switch to the next melee weapon on the hotbar instead of leaving the hand empty.
> - **Useful elite drops.** Elites can drop revolver or shotgun ammo before the player owns either gun. Only roll ammo for guns the player has; otherwise drop materials.
> - **Cloth bottleneck.** Cloth goes into the bone club, bandages, candles, the flask, the lantern trap, shells, the bell repair and two upgrades, but only comes from shrouds and the hut. Add a material-economy test: simulate 3 days of normal gathering and assert the player can afford one weapon, 3 bandages and the first chapel repair. Report any material that runs short.

### F7. Dawn feels like a reward, not a queue
> At dawn the player currently passes a summary card, an upgrade pick (dawn waits until they choose), the merchant and contracts. Combine them into **one dawn screen** in this order: the sunrise shot (3 s), then a single panel with the night's summary on the left and the 3 upgrade choices on the right, then a "Visit the merchant" button. Skip the merchant button when the player has no coins.

### F8. Night pressure and solving the case (E)
> - **Does the journal pause at night?** Right now the journal pauses the game. Under the new design the player has to solve the case at night, so pausing to study the case board would remove all the pressure. Decide: by day the journal pauses; at night the case board can only be *answered* at the altar, and reading the journal at night doesn't pause (the screen dims and sounds stay on).
> - **No brute-forcing.** If a case has 4 possible answers, a player can guess them all. After a wrong answer, lock the altar for 30 s and spawn a wave at once. After 2 wrong answers, require one more clue linked on the board before the next try.
> - **"Zombies left" makes no sense in endless waves.** Replace it with a **Curse meter**: it falls each time a correct clue link is made on the case board, and the night ends when the case is solved. That gives the player a sense of progress during the endless night.
> - **Endless waves need a cap.** Keep at most N zombies alive at once (by stage: 12 / 16 / 20), and despawn any zombie that's been stuck out of reach for 20 s, so a stuck straggler can't freeze progress.
> - **Clues carry over.** When the next stage's clues replace the old ones, keep the solved case readable in a "Closed cases" tab. Nothing the player learned should vanish.

### F9. Endings match what the player did (E)
> The endings are currently decided by the number of relics found by night 5. Under the 3-stage design, base them on how the cases were solved instead:
> - **Rest:** all 3 cases solved, each on the first try.
> - **Uneasy Peace:** all 3 solved, but with wrong answers along the way.
> - **Taken:** only if the player dies on stage 3 and chooses not to retry.
>
> Show on the ending card which case was answered wrongly, so players know what to improve.

### F10. Score fits the horror
> The score system rewards combos and fighting (with a bonus for taking no damage), which pulls against a game about solving mysteries. Add score for: solving a case (+500), first-try solves (+250), clues found (+20 each), and linking clues on the board (+30). Keep combat score, but make solving the main way to score high.

### F11. Small consistency fixes
> - The intro card says "on the shelf" but the page is on the table (also B5).
> - The Child's Locket only appears at night on the west hill, but nothing tells the player that. Add a clue: "Something small glints on the west hill… but only after dark."
> - Lurkers appear by day in Mausoleum Row and the catacombs, which contradicts "no zombies by day" under the new design (E1). Turn them into *scares* by day (a shape in the dark that vanishes) and keep them as attackers at night.
> - Compass and map should show a marker for each of the 3 diggable graves once the player has dug one of them, so they can find them again on later days.

---

## Part G: Lessons from games that solved these problems

Proven patterns from well-known games, adapted to Last Rites. These borrow *mechanics* only (no names, art, characters or levels), which keeps the game original.

| Problem in Last Rites | How other games solve it | What to do here |
|---|---|---|
| Recipes are icons with no names; you can't tell what you're making | **Minecraft**'s recipe book places a faint "ghost" of the missing items in the crafting grid. **Don't Starve** and **Subnautica** show every ingredient with have/need counts, greyed out until you own it. **Valheim** reveals recipes as you pick up their materials. | G1: a ghost preview of the item, faint silhouettes of missing ingredients, have/need counts, and pinning a recipe to the HUD |
| The map inks in, but doesn't say what's *left* in an area | **Resident Evil 2 (2019)** colours rooms red while items remain and blue once they're cleared. **Hollow Knight** only updates the map when you rest, which makes mapping feel earned. **Darkwood**'s map is a paper map you mark yourself. | G2: colour-coded ink (red = something left, grey = cleared), clue and grave markers, player pins |
| Players can guess the case answer | **Return of the Obra Dinn** only confirms your answers in batches of 3 correct, so guessing one at a time tells you nothing. **Phasmophobia** gives an evidence checklist that crosses off impossible answers. | G3: confirm answers in sets; an evidence checklist that rules suspects out |
| Hard to see how clues connect | **Outer Wilds**' ship log draws links between the rumours you've found, with "?" where more is to learn. **Her Story** lets you search clips by keywords you've heard. | G3: the case board shows "?" stubs where a clue is still missing |
| The chapel is "safe", but nothing *feels* safe | **Resident Evil** safe rooms have their own calm music and a save typewriter. **Darkwood**'s hideout is where you barricade before night. **Dying Light**'s safe zones have UV lights that zombies won't cross. | G4: a safe-room feel: candlelight, calm music, a save at the altar, a "Safe" icon |
| Oil runs out and the player is stuck in the dark | **Amnesia: The Dark Descent** makes oil scarce but places it along the main path. **Don't Starve** always lets you craft a torch from basic items, so darkness is a threat you can recover from. | F4 (match) plus oil placed on objective paths |
| Death sends you back with nothing | **Dying Light** keeps your experience when you die and only takes a little. **Darkwood** keeps progress through a save at the hideout. | B2 and F5 (fair retry, keep clues) |
| The night only feels like survival | **Dying Light** doubles experience at night, so taking risks after dark is rewarded. **7 Days to Die** gives fixed "horde nights" so you can plan for them. | G5: night rewards: rare materials and clues that only appear after dark |
| Scares and accessibility | **The Last of Us Part II** has 60+ accessibility options (high contrast, audio cues, combat assists). **Celeste**'s Assist Mode lets players slow the game down without judging them. | G6: comfort and assist options |
| The world feels static | **Alan Wake** uses light as a weapon, so the lantern matters in every fight. **Dead Space** puts the health bar on the character's back instead of a HUD, so the world itself shows your state. | G7: a world that reacts |

### G1. Workbench: see what you're making
> Rework the workbench recipe book so a player can understand a recipe without hovering:
> - **Recipe name** in IM Fell English SC above each card, and **ingredient names** under each icon, with "have / need" counts ("Bone 1/3"). Missing counts in blood red; owned ingredients in ink.
> - **Ghost preview:** selecting a recipe shows a faint, unshaded (low-opacity, desaturated) 3D model of the finished item floating above the bench. It fills in to full colour and glows as the craft completes. Missing ingredients appear on the bench as faint outlines in their spots; owned ones appear as solid models.
> - **Pin a recipe:** "Pin" puts the recipe in a small HUD card under the objective tracker ("Bone Club: Bone 1/3, Cloth 1/1"). It updates as materials are picked up and unpins itself when crafted.
> - **Discovery:** recipes show as "???" with a silhouette until the player has picked up at least one of each ingredient. The player sees what's possible without the whole list at once.
> - Keyboard-only use must still work, and every state must be readable without colour (counts and icons, not colour alone).

### G2. A map that tells you what's left
> Extend the existing ink-as-you-explore journal map:
> - **Ink colours:** explored areas with a pickup, clue or diggable grave left show in red ink. Areas with nothing left fade to grey. Unexplored areas stay blank parchment. Add a legend, and use hatching as well as colour so it isn't colour-only.
> - **Markers:** every found clue's location gets a small ✎ mark, the 3 diggable graves get a ⚰ mark once one has been dug, and the chapel and hut always show.
> - **Player pins:** clicking the map drops up to 5 pencil pins with a label the player types ("oil?", "come back"). They show on the compass too.
> - **The map draws itself:** newly explored cells ink in with a short pen-scratch sound the next time the journal opens (this already exists; keep it and add the sound).
> - At night, the map dims and doesn't show zombies, so it stays a planning tool, not a radar.

### G3. Cases you can't guess and can follow (E)
> For the case puzzles from E2:
> - **Batch confirmation:** for multi-part answers (for example "who" + "which grave" + "what order"), the altar only says "The curse loosens" when *all* parts are right. Otherwise it says "Not yet". It never says which part is wrong. Guessing becomes pointless; reasoning is required.
> - **Evidence checklist:** each case lists its suspects or graves, and the player can cross them off. Each clue found rules at least one out, and the checklist shows which clue ruled out what.
> - **"?" stubs:** on the case board, each case shows empty pinned cards with "?" for clues not found yet, plus a one-line hint of where to look ("Something by the bell tower…").

### G4. The chapel feels safe
> When the chapel doors are barred and the player is inside:
> - The music changes to a calm, quiet piece (synthesised, like the rest of the score).
> - The candles burn warmer, and a "Safe" glyph (✝ plus text) shows by the health bar.
> - The altar save shows as "Rest and save" (once repair stage 2 is built).
> - When a board breaks, the calm music cuts out at once. That contrast is the scare.

### G5. Night is risky but rewarding
> - Some materials (grave salt, silver filings) and 1–2 clues per case only appear at night, marked by a faint glow, so leaving the chapel at night is a choice with a payoff.
> - Show "Night find" in the pickup toast. Score: ×1.5 for anything collected at night.

### G6. Comfort and assist options
> Add to Settings, grouped under "Comfort" and "Assist":
> - **Comfort:** scare intensity (exists), no-flash (exists), "warn before jump scares" (a subtitle half a second before each one), a "no grab close-up" toggle, and a volume slider just for scare stingers.
> - **Assist:** zombie speed 75%, damage taken 50%, longer days, unlimited lantern oil, and "highlight clues within 5 m". Assist settings show a small mark on the score screen but never block endings or achievements.

### G7. A world that reacts
> Small touches that make the cemetery feel alive, each cheap to build:
> - **Light matters:** zombies shield their eyes and slow 20% inside the lantern's beam. The Wraith (E6) only becomes solid in the beam.
> - **The world remembers:** dug graves stay open for the rest of the run; broken boards stay on the ground; muddy footprints follow the player at night and fade by morning.
> - **Animals as warnings:** crows burst from trees when a zombie or Lurker is nearby (a hint, not a scare). By day, a black cat sits by an unfound clue now and then.
> - **The keeper's breath:** visible breath in the cold at night. Heavier breathing when stamina is low, instead of only the bar.
> - **The weather tells the time:** fog thickens and the wind rises as dusk approaches, so the player feels night coming before the clock says so.
> - **Elias:** at each dawn, a faint figure of Elias stands somewhere in the fog, by a clue the player missed, and vanishes when approached. It's a guide and a ghost story in one.

---

## Part D: Test prompts (run after developer mode and B1 are in)

Each of these asks Kiro to test an area with dev mode, report problems, and add an automated test where it can.

**D1. The main story path**
> With dev mode, play the main story from page 1 to an ending, walking between objectives rather than teleporting. At each step, report whether the objective text, compass marker, pickup prompt and journal entry all update correctly. Note any step where it's unclear what to do next.

**D2. Crafting and the workbench**
> With dev mode, give the player enough materials and craft every recipe at the workbench, including the recipes that unlock after nights 1–4, page 3, the revolver and the shotgun. Check that:
> - the items you can combine glow as the README promises
> - crafting takes 1.5 s and is cancelled by a hit
> - the result reaches the hotbar
> - durability and consumables work
> - the Upgrades tab works
>
> Report any recipe that can't be crafted or whose numbers don't match `docs/game-design.md`.

**D3. Digging and materials**
> With dev mode, teleport to each of the 3 diggable graves (oak hollow, north row, low field) and dig. Check that:
> - the 3 s hold works and is cancelled by moving
> - the grave can only be dug once per day
> - the loot is sensible
> - the hand-from-grave scare can fire
>
> Also check every material spawn point (broken coffins, chapel font, pews, crypt shelves, catacomb walls) and confirm it refills each day. Report whether 3 diggable graves is enough for players to find, and whether they need markers.

**D4. Chapel repairs**
> With dev mode, give the player materials and do every chapel repair. Check that the repair UI opens and closes, costs are taken, repairs survive into the next night, and each one has a visible effect.

**D5. Night combat and balance**
> With dev mode, play nights 1 to 5 at normal speed, first with only the shovel, then with each crafted weapon. Record the time to die with no weapon, how many zombies each night spawns, and the oil left at dawn. Check:
> - the Lurker in the dark alleys
> - the Wailer scream
> - elite zombies
> - the holy-water flask's double damage
> - melee range and arc
> - dodge
>
> Report whether night 1 is survivable for a new player who followed the objectives.

**D6. Scares and comfort settings**
> With dev mode, trigger every scare id at scare intensity Full, Reduced and Off, and with no-flash mode on. Confirm that "Off" never plays a jumpscare, every scare is telegraphed, and every important sound has a subtitle. Report any scare that ignores the settings.

**D7. Endings and save/load**
> With dev mode, trigger each of the 3 endings and check the ending and summary screens. Then save mid-run, reload the page and continue. Report anything that isn't restored: inventory, objective, repairs, day number, oil.

**D8. Performance**
> With dev mode's FPS counter, measure frame rate and draw calls in the hut, the open grounds at night with a full wave, Mausoleum Row, the catacombs and the boss fight, at 1366x768 and 1920x1080. Report any spot below 50 fps and suggest fixes. Also check the first-load time and the total download size of the Vercel build.

**D9. Screens and settings**
> Check every menu at 800x600, 1366x768 and 1920x1080: content warning, title, difficulty, pause, settings, rebinding, achievements, credits, journal tabs, satchel and death screen. Make sure keyboard-only navigation works and every button is reachable without scrolling. Add Playwright screenshot tests for each.
