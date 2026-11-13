# Kiro prompt: horror pass (screen jumpscares, new creatures, bats, journal info dots, vending machine, hands and lantern)

Paste everything below the line into Kiro. Do it **after 11n (scenery swap)**.

---

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

Claude is building **original** realistic zombie models in Blender, in the style of modern survival-horror games:
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
