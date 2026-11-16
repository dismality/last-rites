# Kiro prompt: everything not yet in Kiro's task list

Paste everything below the line into Kiro. It collects everything Kiro hasn't done yet: 11n-f (the chapel stair traps the player and leads nowhere), the rest of 11n-e (draw calls), 11p (textured zombie colours), 11q (clue models, reveal text and journal entries) and spec 11 (horror pass). It replaces pasting `kiro-prompt-chapel-stair-fix.md`, `kiro-prompt-zombie-tint.md` and `kiro-prompt-clue-reveal.md` separately. Part C of `kiro-prompt-all.md` is included in full.

---

These are new tasks from the user's playtests that aren't in your task lists yet. Add them first, then work in this order. This order overrides any "do it next" line inside the parts below.

1. Add **11n-f** to `.kiro/specs/09-playtest-fixes/tasks.md` and do it first (Part 0 below). It blocks the story path.
2. Finish **11n-e**: the chapel stair, ground hole and hut lantern are in (3feb71a); only the draw-call work is left (Part 0, last section). Then tick 11n-e.
3. Add **11p** and **11q** to the same tasks file after 11n-f, and create **spec 11-horror-pass** (`.kiro/specs/11-horror-pass/`: requirements, design, tasks) from Part C. Commit the task lists on their own. Also commit Claude's uncommitted files with them: `public/assets/icons/clues/`, `tools/blender/clue_icons.py`, `tools/blender/chapel_interior.py` with `chapel-interior.glb` and `chapel-interior-colliders.json` (pews moved for 11n-f), the clue-icons row in `docs/CREDITS.md`, and the `docs/kiro-prompt-*.md` files.
4. Do **11p**, then **11q**.
5. Do **spec 11, H1 to H7**.
6. Carry on with spec 10.

Same rules throughout:
- read the design bible first and update it when a system changes;
- a kiro-log entry per task;
- lint, build and unit tests pass;
- commit locally after each task, **never push**;
- decisions made without the user go under "Decisions made unattended".

Claude makes the art. Where a file isn't in the repo yet, build against a clearly marked placeholder, keep going, and list what's waiting at the end. Never ship your own stand-in art as final.

The feature freeze is **26 November**. If spec 11 can't all fit, finish in this order and report what's left: H6 (vending machine), H1 (screen jumpscares), H4 (bats), H5 (info dots), H7 (hands and lantern), then H2 and H3 (new creatures, which need Claude's models).

---

# Part 0. 11n-f: the chapel stair traps the player and leads nowhere

The user's words: "after the stone grinds it blocks me in" and "I can't enter, if I'm supposed to".

### What goes wrong

1. **The altar lands on the player.** The whistle is used at the altar trigger (chapel-local z 4.5). When the stair opens, `altarRestOffset` moves the altar collider 0.6 m toward the door at once, to z 3.9..4.7. That's on top of the player, who gets pushed out in front of the altar.
2. **There was no way round the altar.** The back pews ended at z 3.29 and the slid altar collider starts at z 3.9. That leaves a 0.61 m gap, but the player capsule is 0.70 m wide (radius 0.35). So the player can't reach either side of the altar, or the stair behind it.
3. **The stair is a dead end.** The steps run 1.1 m to the end wall and into a black vault. Nothing takes the player down to the catacombs, so the reveal ("Stone shifts beyond the altar. A stair is open.") promises an entrance that doesn't exist. Today the only way in is the iron corridor gate at x 25 on the south edge, which opens on the same gate flag.

### Already done in the art (Claude)

`tools/blender/chapel_interior.py` now puts the pew rows at z 0.4, 1.4 and 2.4 instead of 1.0, 2.0 and 3.0. Both `chapel-interior.glb` and `chapel-interior-colliders.json` are re-exported, and only the six pew boxes changed. The back pews now end at z 2.69, which leaves a walkway of about 1.2 m between them and the slid altar.
- Move the `chapel-pews` loot spot in `src/data/zones.ts` from `[8.5, 0.41, 8]` to `[8.5, 0.41, 7.4]`, so it sits on the back west pew's seat again.
- Update any test or dev data that assumes pews at z 1/2/3 (the aisle-clearing tests, congregation points, the case-altar screenshots).

### Fixes in code

1. **The altar must never land on the player.** Use whichever approach is simpler, but the result must be that the player is never inside the altar collider:
   - **(a) Kinematic collider:** give the altar collider its own kinematic body that follows `altarSlideOffset` every frame. While the altar slides, push the player capsule out ahead of it, toward −z.
   - **(b) Step back first:** when the whistle is used, ease the player back to chapel-local (0, 3.2), facing the altar, over 0.4 s before the slide starts (a stumble back as the floor shakes, with a light camera shake). Keep input locked only for those 0.4 s.
   - **Either way:** add a safety net. If the player capsule ever overlaps a chapel collider after the slide, move it to the nearest free spot in the aisle.
2. **A walkable route round the altar.** Check, with a 0.35 m radius capsule, that the player can walk from the aisle round **both** sides of the slid altar to the back edge of the opening (z about 4.75) and step onto the ramp. If the vestry cupboard, the floor break at (1.7, 4.6) or anything else pinches the route under 0.8 m, shorten that collider and log it.
3. **Going down takes you to the catacombs.** Add a descent trigger:
   - **Trigger:** a box inside the stair opening whose top sits below y −0.5, so the player has to walk down about three steps.
   - **Entering it:**
     - fade to black over 0.6 s;
     - play footsteps on stone going down, with the caption "[footsteps descend into the dark]";
     - put the player inside the catacomb corridor just past its gate (world x 25, z ≈ 41.5, facing +z), with velocity zeroed;
     - fade back in over 0.8 s.
   - **Input:** locked only while the screen is black.
   - **Zone:** set the zone to `catacombs` and fire whatever the corridor gate already fires on entry, such as guidance, the objective step and the music bed.
   - **Way back:** the corridor's open gate is the way out to the graveyard. Add a matching ascend trigger only if it's cheap: at the corridor mouth, inside the gate, it would put the player at the top of the chapel stair facing −z. Otherwise just walking out of the gate is fine.
   - **Guidance:** once the stair is open, the waypoint, objective text and compass marker should point at the chapel stair, not the corridor gate.
   - **Saves:** Continue and both Retries restore a player who was in the catacombs to the corridor, never to the inside of the stair shaft.
4. **The stair stays readable as a stair.** Keep the end wall collider where the vault comes down, so the player can't walk into the black block. The fade should start before they reach it.

### Tests

**Unit:**
- the trigger's box sits inside the opening and below y −0.5;
- the arrival point is inside the catacomb corridor and clear of its colliders;
- after the slide, a 0.35 m capsule fits along the walkway on both sides of the altar, with every collider taken into account;
- the moved loot spot sits on a pew seat.

**Browser** (screenshots at 1280x720):
1. stand right against the altar, use the whistle (dev hook), and watch the slide: never stuck, no jitter inside the altar;
2. walk round the left side and the right side of the altar to the stair;
3. walk down and arrive in the catacombs after the fade;
4. walk back out through the corridor gate;
5. Continue from a save made in the catacombs.

### Rest of 11n-e: draw calls

**Draw calls (230–374, budget 150).** The scene models are small: graveyard 23, hut 18, chapel interior 16, catacombs 14, chapel exterior 11 primitives. Most of the count comes from props placed one by one. Use `InstancedMesh` (or drei `<Instances>`) for repeated props (headstones, candles, bones, bats, crates), merge static props per area with `mergeGeometries` where they share a material, and skip rendering areas the player is not in (catacombs while outside, the graveyard while underground). Log the draw calls before and after in the kiro-log, and say which areas are still over 150.

---

# Part A. 11p: the textured zombie keeps its own colours

`public/assets/models/enemies/zombie.glb` is now a realistic, textured gravedigger zombie (see `docs/enemy-models.md`). It still uses the same skeleton, the same 9 clips and the same `ENEMY_LOOKS` ids, so nothing else has to change. But the tinting in `EnemyModels.tsx` and `zombieMaterial.ts` was tuned for the old flat cartoon colours, and on the texture it gives a blue-purple cast at night:
- `tintedMaterial` sets `color` from `adjustZombieColor(white, tint)`, which caps the value at `ZOMBIE_MAX_VALUE` (0.62) and darkens the whole texture;
- `zombieColdFill` adds a blue emissive scaled by that colour, which washes over the texture in the dark.

**Fix:** when the source material has a `map` (a texture), treat it as a textured skin:
- **Shambler** (white tint): leave `color` at white so the texture shows as painted. Keep the roughness, metalness and env settings from `ZOMBIE_MATERIAL_PARAMS`.
- **Other looks** (lurker, wailer, bloater): apply the tint as a gentle multiply on the texture, blended about 50% toward white, so they still read as different without losing the texture. Keep `ZOMBIE_MIN_VALUE` so the lurker stays visible.
- **Cold fill:** make it much weaker on textured skins, around 25% of today's `COLD_FILL`, or remove it if the lantern no longer turns the texture orange. Judge this in Chrome at 1 to 2 m in lantern light, the case the fill was added for (playtest item 7).
- The brute and Father Crane still use the untextured Quaternius brute, so keep today's path for materials without a `map`.

Keep the maths pure in `zombieMaterial.ts`, add unit tests for the textured branch, and take screenshots at night: the shambler, lurker and wailer at 2 m in lantern light and at 8 m in fog, at 1280x720.

---

# Part B. 11q: clue models, clue reveal text and journal entries

The user's words: when a clue is found, the clue should have a design of its own (today it's a blank object), its text should appear a bit below the middle of the screen as fading text, and it should be logged in the journal.

## 1. Each clue spot shows its own model

`ClueSpots.tsx` still draws three plain boxes (`parchment`, `coat`, `marks`). Claude built one model per clue in Blender, so swap them in now. This is the clue row of 11n-d, done early; skip it there if it's already done.

- Load `public/assets/models/props/<clueId>.glb` for each spot in `CLUE_SPOTS` (all 9 exist: `clue-hut-boots`, `clue-empty-graves`, `clue-west-hill-glint`, `clue-ledger-week`, `clue-row-statues`, `clue-elias-body`, `clue-cat-scratches`, `clue-cat-names`, `clue-cat-ledger-seal`). Use `useGLTF(url, DRACO_PATH)` with `<Clone>`, and add them to `preloadModels`.
- **Facing:** models face +Z unless noted.
  - `clue-cat-scratches` faces +X: it sits against the catacombs' west wall.
  - `clue-cat-names` faces −X: it sits against the east bone wall.
  - Rotate each one so its front faces the path the player arrives from, and check every spot in the browser. Where a model would clip into the new scenery (the hut cot, catacomb ledges, the bier), move the spot a little and log the change.
- **Colliders:** where a clue has a `.json` next to it (the notice post, the sealed-entry stone, the statue plinth, the bench), add its boxes.
- **Highlight:** keep the `Interactable`, the rune and the hug-the-model outline from 11o, now fitted to the real model.
- Delete the old `Prop` boxes, and the `prop` field if nothing else uses it.

## 2. The clue text fades in below the centre of the screen

Today a found clue only gives the toast "Added to your journal (J)". Replace that, for clues only, with a **clue reveal**:

- **Where:** centred horizontally, with its top edge at about 58% of the screen height. That's a little below the crosshair, and clear of the crosshair, the interaction prompt, the captions, the toasts, the hotbar and the health bar at 1920x1080, 1280x720 and 800x600. At most 640 px wide (90% of the width on small screens).
- **What it shows, top to bottom:**
  1. **Picture:** the clue's picture, `public/assets/icons/clues/<clueId>.png` (Claude rendered all 9 from the models), about 96 px, with a soft dark vignette behind it. Clues with no picture (headstone and plaque clues such as `clue-marsh-stone`, the wrong-grave clues and `clue-crane-plaque`) show no image; don't draw a placeholder.
  2. **Title:** the spot's `label` (e.g. "Elias's boots"), or a short title from `clues.ts` for clues without a spot. Small caps, IM Fell English SC.
  3. **Text:** the clue's `text` from `clues.ts`, in the HUD's ink-on-dark style, 18 px or more, with a dark text shadow so it reads on fog and on lantern-lit walls.
  4. **Journal line:** one small line, "Noted in your journal (J)", with the key read from the player's binding (reuse `journalAddedText`'s key logic).
- **How it moves:**
  - **In:** fades in over 0.5 s with a 6 px rise, with ink spreading: the letters start slightly blurred and sharpen.
  - **Hold:** 3.5 s plus 45 ms per character, capped at 10 s.
  - **Out:** fades out over 1.2 s.
  - With reduced motion: a plain fade, no rise and no blur.
  - The player can keep moving the whole time; it never takes focus or blocks input.
- **Queue:** if two clues are found close together, show them one after another, never stacked. A clue found while a menu, the journal, the workbench, the big map, examine or a cutscene is open waits until it closes. One that has waited over 30 s is dropped, since it's already in the journal.
- **Sound:** a quiet page-turn and quill-scratch, on the SFX bus, with a caption "[quill scratches]".
- **Trigger it for every clue discovery:** examined spots, headstones read with the ledger, the Crane plaque, and the stage clues from spec 10. One place, listening to the mystery store's discovery (or its event), not each caller. Don't fire on Continue or a Retry restore.
- **Ledger refusal:** "The entries mean nothing without the parish ledger to compare." should use the same position and fade, but with no picture, no title and no journal line, so it isn't mistaken for a found clue.
- **Code:** the timing and queue logic is pure, in `src/game/systems/clueReveal.ts`, unit-tested. The component goes in `src/ui/hud/ClueReveal.tsx`, and titles in data.

## 3. Logged in the journal

The Clues tab already lists found clue text. Make each entry match the reveal:
- **Entries:** the picture (48 px, or nothing if the clue has none), the title, then the text. Show entries in the order found, oldest at the top, with the newest marked by a small red ink dot until the journal has been opened once.
- **Tab badge:** the Clues tab label shows a count of unread clues, e.g. "Clues ·2".
- **Saving:** found order and read state are saved, and restored on Continue and both Retries. Old saves with no order use the `CLUES` order.
- **Case board:** clues still pin to the case board as today; check that the reveal doesn't double up with the case board's own message.

## Tests

**Unit:**
- the queue (two clues in a row, waiting through a menu, dropping after 30 s);
- the hold time from the text length, with its cap;
- every `CLUE_SPOTS` id has a model and a picture;
- clues with no picture render without an image;
- unread count and order saved and restored.

**Browser** (screenshots at 1280x720 and 800x600):
1. walk up to the hut boots and examine them: the model is visible, the reveal fades in below the crosshair, holds and fades out;
2. find two clues quickly and see them play one after another;
3. try a ledger clue without the ledger and see the plain refusal line;
4. open the journal and see the entries with pictures, the red dot and the badge clear;
5. check every clue spot's model in place, with no clipping into walls, the cot or the ledges;
6. check reduced motion.

---

# Part C. Horror pass (new spec 11)

The user played the game and wants it scarier and easier to read:
- real screen jumpscares;
- more kinds of creatures with different traits;
- Halloween touches that make you uneasy;
- zombies that look like horror-game zombies;
- small info dots in the journal that explain how things work;
- a coin-op vending machine in the hut;
- detailed first-person hands, with a more realistic lantern light.

Make this **spec 11-horror-pass** in `.kiro/specs/11-horror-pass/` (requirements, design, tasks), with the tasks below. Same rules as always:
- design bible first, and add a §12 "Horror pass" to it;
- a kiro-log entry per task;
- lint, build and unit tests pass;
- commit locally after each task, never push.
- Decisions you make on your own go under "Decisions made unattended".

**Claude makes the art in Blender** (models, rigs, animations, the jumpscare images). The paths below are fixed. Where a file isn't there yet, build the system against a clearly marked placeholder, keep going, and list what's waiting. Never draw your own stand-in art and ship it as final.

## H1. Screen jumpscares

**What the user wants:** a scary face that slams onto the screen instantly and sticks there. A zombie face comes **up from the bottom edge**; a ghost comes **down from the top edge**.

**How it plays:**
- `ScreenScare` overlay above the HUD. The image covers about 85% of the screen height and is anchored to the bottom or top edge.
- **Timing:**
  1. **In:** 70 ms (no ease-in; it arrives at once), with a 1-frame white flash.
  2. **Stick:** 550–800 ms, with a sharp camera shake that decays, a fast scale jitter (1.00 → 1.04) and a chromatic split on the image edges.
  3. **Out:** a 250 ms slide back and fade.
  - The world under the face goes to 30% brightness for the hold.
- **Audio:** each scare has a sting. Use a layered sting: a sharp attack plus a low thud, and a scream or wail. Add them to the sound list and use placeholders until Claude supplies the files. Duck all other audio by 70% for the hold.
- **Triggers are earned, never random noise:**
  - **Pale Crawler ambush (H2):** when one bursts out within 1.5 m in front of the player → bottom zombie face. The player then takes the crawler's grab damage as normal.
  - **Hollow Bride (H2):** when she reaches the player → top ghost face, then the oil drain.
  - **Scripted moments**, one each, at most once per save:
    - opening a particular broken coffin at night 2;
    - looking out of the hut's west window at night 3 (a face presses against the glass from the bottom);
    - the ossuary door's grille the first time the player looks through it.
  - **Cooldown:** at least 3 minutes between screen scares. Never during menus, the journal, the workbench view, the big map, examine, cutscenes or endings.
- **Setting: "Jumpscares: Full / Reduced / Off"**, defaulting to Full.
  - **Reduced:** no flash, no shake, no chromatic split, quieter sting; the face is still shown.
  - **Off:** none of it.
  - With "Flashing lights" off, the flash and the chromatic split are always removed.
- **Art (from Claude):** transparent `.webp` images, 2048 px tall, under 300 KB each:
  - `public/assets/scares/face-zombie-1.webp`, `face-zombie-2.webp`, `face-crawler.webp` (from the bottom);
  - `public/assets/scares/ghost-bride-1.webp`, `ghost-bride-2.webp` (from the top).
  - Pick at random from the matching set, never the same image twice in a row.
- **Rules and data:** scare definitions in `src/data/screenScares.ts`; the cooldown, trigger and choice logic (pure) in `src/game/systems/screenScares.ts`.

## H2. New creatures, each with its own traits

Today's roster is shambler, lurker, wailer, bloater, brute and Father Crane. Add three original creatures, each with a clear role. Every number below is a starting point; tune it against the design bible's difficulty curve, and log what you changed.

| Creature | Look (Claude's model) | Speed | HP | Behaviour | Weakness | First night |
|---|---|---|---|---|---|---|
| **Pale Crawler** (`crawler`) | an emaciated grey corpse dragging itself on its arms, jaw hanging | 1.2 m/s crawling, 6 m/s for a 0.6 s lunge | 35 | Waits hidden under grave mounds and broken coffins (spawned at those spots, invisible until it moves). Bursts out when the player passes within 2 m and grabs for 8 damage (H1's bottom scare). Its low body ducks horizontal swings: hit it with a downward swing or a shot. | fire (lantern trap), any gun | 2 |
| **Hollow Bride** (`bride`) | a drifting ghost in a torn veil and wedding dress, feet never touching the ground | 2.2 m/s drift | 60 | Passes through fences and gravestones, but not the chapel or hut walls. **Only visible inside the lantern's cone or within 3 m.** When she touches the player she drains 20% lantern oil (H1's top scare), then vanishes and returns 30–60 s later. She can't hurt your health. | holy water, silver sabre, salt circle (she can't cross it). Lead passes through her. | 3 |
| **Corpse Hound** (`hound`) | a rotting, hairless mastiff with exposed ribs | 5.5 m/s | 45 | Comes in packs of 2–3. They circle at 4–6 m, then one darts in for 10 damage while the others hold. A lantern flare or a gunshot scatters the pack for 4 s. | guns, heavy swings | 4 (stage 2 onward) |

- **Add each to:** `enemies.ts` (`EnemyId`, `ENEMY_MAP`, `ENEMY_LOOKS`), the wave tables, and the elites list where it makes sense. Not the Bride: she is a haunting, not a wave enemy. Spawn at most one Bride at a time, from stage 2.
- **Bestiary:** a "Creatures" page in the journal shows each creature once it's been seen: its sketch, a short field note, and "What works".
- **Keep it fair:** each creature has a readable tell before it attacks. The crawler has a soil shiver and a wet click. The Bride lets out a cold breath, the lantern flame bends, and a faint humming plays. The hounds growl from the dark before they circle. Add sounds and captions for each.

## H3. Zombies that look like horror-game zombies

**Already done:** `zombie.glb` is now a realistic, textured 1890s gravedigger on the same skeleton and the same 9 clips (11p fixes its colours). It's one look for now; more looks and the new creatures will follow in the same contract.

Claude is making **original** realistic creature models, in the style of modern survival-horror games:
- grey-green, mottled skin with exposed tendons;
- torn burial clothes from 1891 (a farmhand, a woman in a burial gown, a gravedigger, a mourner in a top hat);
- cloudy eyes, broken teeth;
- a shambling gait.

**The contract,** so the swap is only a file change:
- `public/assets/models/enemies/zombie.glb` (base, with several looks), `zombie-brute.glb`, plus the new `crawler.glb`, `bride.glb` and `hound.glb`.
- Same clip names as today: Idle, Walk, Run, Crawl, Attack, Lunge, Threaten, HitReact, Death. The hound and the Bride swap Crawl for their own movement clip.
- One skinned mesh per creature, under 15k triangles. Several looks sit in one file as named mesh variants (`look-0..3`), shown one at a time.
- **Prepare the code now:**
  - variant selection per spawn (deterministic from the uid);
  - a per-variant tint that's now optional;
  - the new ids in `ENEMY_LOOKS`.
  - Until the files arrive, keep using today's models for the new ids, scaled and tinted, and mark them as placeholders.

## H4. Halloween unease: bats that watch you

- **Bats perched on headstones:** 8–12 at night, from stage 1, sitting on the tops of headstones and mausoleum roofs. Take positions from the graveyard collider box tops: `graveyard-colliders.json`, boxes 0.6–1.6 m tall.
  - Model: `props/bat-perched.glb`. The "head" and "eyes" meshes turn on Y toward the player, eased and up to 120°, while the player is within 14 m. That's the "staring" the user wants.
  - The eyes glow faintly (emissive). Add no light.
  - At most one chitter sound every 20 s, and quiet.
- **They take off:** when the player comes within 3 m, or fires a gun within 10 m, the bat swaps to `props/bat-flying.glb`. Its wings flap about the `wing-left` and `wing-right` pivots, about 8 flaps a second. It flies off along a curved path, fades out after 6 s, and comes back to a new grave after 2 minutes.
- **Optional, if the frame budget allows:** a flock of 15–20 flying bats that bursts out of the chapel belfry when the dusk bell rings. Use instancing with simple wing flapping in the vertex shader.

## H5. Info dots in the journal

A small circled **i** sits next to each journal section heading and the key HUD panels. Hovering it (or focusing it with Tab; on touch, tapping it) shows a short tooltip on **how to play**, not the story. Use the HUD's parchment style, at most 2 sentences, readable at 800x600 with the plain font.

- **Write each text from what the code actually does.** The drafts below are written from the current design; check each against the systems and correct it rather than shipping it as written:
  - **Case board:** "Drag a red string between two clue cards you think are connected. Each true link lowers the Curse; answer the case at the chapel altar at dusk or night."
  - **Clues:** "Clues are added when you examine marked places and read headstones. Some only make sense once you carry the parish ledger."
  - **Curse meter:** "The Curse keeps the nights going. It drops with every true link on the case board and ends when the case is answered."
  - **Hints:** "Stuck? A hint costs 5, then 10, then 20 coins and points you at the next clue."
  - **Map:** "Press M for the big map. Click to drop up to 3 pins; pins show on the compass and the minimap."
  - **Recipes:** "Unknown recipes show where their missing ingredients are found. Pick up one of each ingredient to learn the recipe."
  - **Satchel / relics:** "Relics are needed for the final rite. They are found, never bought."
  - **Lantern oil:** "Oil burns while the lantern is lit. Refill it from the satchel or at the bench; with no oil you're in the dark."
  - **Stamina:** "Sprinting uses stamina; it refills when you walk or stand still."
  - **Bestiary (H2):** "Each creature you've seen, with what works against it."
  - **Coins:** "Coins come from graves, coffins and the dead. Spend them on hints, with Silas at dawn, or at the hut's vending machine."
- **Implementation:**
  - Texts go in `src/data/infoTips.ts`, keyed by section.
  - One `InfoDot` component, with `aria-describedby` and an Escape key that closes the tooltip.
  - A setting "Show info dots" (on).
- **Tests:** every journal section and the listed HUD panels have a tip, and each tip is at most 2 sentences.

## H6. The hut's vending machine

**"Hollowmere Automatic Dispenser":** a coin-op cabinet in the style of the 1890s. Model: `props/vending-machine.glb` at hut (2.83, 0, 1.85), rotationY −PI/2. Its colliders are in `hut.json` and the machine's JSON.

- **Use:** press E to open a small panel in the merchant's style. One row per item shows the price, today's stock left, and what it does. Buying:
  1. the coin clinks (sound);
  2. that row's brass handle pulls out about 5 cm and springs back (anchors `handle-0..4`);
  3. the goods "drop" into the tray.
  It takes about 1.2 s, during which you are not protected. It works by day and by night.
- **Stock:** only convenience items. **No relics, key items, journal pages, recipes, clues, holy water or silver**: exploring stays the way to get what matters. Prices sit a little above Silas's (he's only there at dawn), and stock resets at dawn:

| Row | Item | Price | Per day | Notes |
|---|---|---|---|---|
| 0 | Revolver Cartridges x6 | 12 | 2 | needs the revolver |
| 1 | Shotgun Shells x4 | 14 | 2 | needs the shotgun |
| 2 | Lamp Oil x1 | 5 | 3 | |
| 3 | Kola Tonic x1 (stamina) | 18 | 1 | |
| 4 | **Brisk Draught** x1 (new) | 15 | 1 | +25% move speed for 60 s; can't stack. New consumable, icon and model from Claude: `items/brisk-draught.glb`. Use a placeholder bottle until then. |
| — | Bandage x1 | 7 | 2 | shares row 2's handle visually |

- **Marquee light:** the marquee glass is emissive; add one small warm light at `marquee-light` only if the budget allows. Show a "Sold out" card when a row is empty.
- **Data:** in `src/data/vending.ts`, pure rules in `src/game/systems/vending.ts`.
- **Unit tests:** prices, stock reset at dawn, needs-weapon rows hidden, no forbidden item can ever be stocked, coins never go negative.
- **Update the H5 coins tip.**

## H7. Detailed hands, and a more realistic lantern

**Hands (model from Claude):** `public/assets/models/viewmodel/hands.glb`, rigged, with clips:
- `Grip-Pistol` (revolver);
- `Grip-Haft` (shovels, axe, club, sabre);
- `Grip-Long` (shotgun, two-handed);
- `Lantern-Hold` (left hand around the lantern's bail);
- `Throw`, `Reload-Revolver`, `Reload-Shotgun`;
- `Swing-Light`, `Swing-Heavy`.

The hands have work-worn skin, dirt under the nails, and a wool coat cuff with a frayed edge. Also `viewmodel/lantern.glb`: a caged iron lantern with separate `glass` and `flame` meshes.

**Today the viewmodel shows only the weapon.** Change it to:
- **Right hand** holds the weapon, in the pose for its grip class.
- **Left hand** holds the lantern at about hip-to-chest height, swaying with walking (follow-through on turns, a lag of about 80 ms). It lifts a little when the player raises it to look (if there's a lantern-raise action) and lowers when sprinting.
- **Shotgun:** the left hand moves to the fore-end. The lantern hooks onto the belt and its light comes from the hip, pointing forward and a little down. Tell the player once with a caption: "Lantern hooked to your belt".
- **Throwing and two-handed heavy swings:** the left hand lets go of the lantern for the swing and catches it again. The lantern hangs from the wrist strap during the swing.
- Until `hands.glb` arrives, keep the current viewmodel and make the code ready for the new one.

**A more realistic lantern light:**
- **Light origin:** the light comes from the lantern glass in the left hand, not from the camera. As the lantern sways, the shadows move.
- **Spot:** the main spot is shadow-casting and points forward from the lantern.
  - Use a cookie (`SpotLight.map`) of the lantern cage's bars, so faint bar shadows fall on nearby walls. Claude supplies `public/assets/textures/lantern-cookie.png`; until then use a soft round placeholder.
- **Fill:** a small fill point light (no shadow) with a short radius.
- **Colour:** about 1900 K, like a candle or kerosene flame (`#ffb46b`).
- **Flicker:** driven by layered noise, not a sine wave. Slow breathing plus quick gutters, with occasional dips of up to −25%. The `flame` mesh scale and the glass emissive follow the same signal.
- **Oil level:** brightness and range follow the oil level. Below 15% oil the light gutters harder and turns redder; at 0 it goes out with a small last flare.
- **Movement:** sprinting and wind gusts make it flicker more. The Bride's approach bends the flame and dims the light by 30% (H2).
- **Bloom** on the flame and glass only (see 11n's renderer notes).
- **Performance:** benchmark before and after with the GPU perf project. The lantern's shadow map stays at 1024 or below, and the "Low" setting turns the cookie off.

## Realism features to keep consistent (from the Blender side)

Everything Claude builds follows the same rules as the scenery in 11n:
- Weathering lives in the vertex colours: moss on up-facing surfaces and near the ground, rain streaks, darker grime low down, rust in patches, wood grain along the board.
- Real bevels and geometry for details; no flat boxes.
- Emissive materials for anything that glows, with an anchor for any real light.
- One-sided panes where inside and outside must differ.
- Draco compression.

So don't override model materials with flat colours. Keep tone mapping on AgX or ACES, and keep the subtle AO and selective bloom from 11n.

## Tests (whole spec)

**Unit:**
- scare cooldown and gating, and the setting's three modes;
- creature data and traits;
- the Bride can't cross salt and can't be hurt by lead;
- the crawler ducks horizontal swings;
- vending rules;
- info tips complete;
- the bat state machine (perched → flee → return).

**Browser** (screenshots at 1280x720 and 800x600):
1. each screen scare at Full and Reduced, showing the face from the bottom and the ghost from the top;
2. a crawler ambush;
3. the Bride seen only in the lantern cone;
4. the hound pack circling and scattering at a gunshot;
5. a bat turning its head as you walk past, then taking off;
6. hovering each info dot;
7. buying from the vending machine (handle pull, coins drop, stock count);
8. the hands with each grip class, the lantern on the belt with the shotgun;
9. the lantern's cage shadows on the hut wall;
10. GPU perf before and after.

At the end, list everything still waiting on Claude's art (paths), so the user can see it at a glance.
