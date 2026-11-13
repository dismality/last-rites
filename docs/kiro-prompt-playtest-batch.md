# Kiro prompt: playtest batch (11m, 17, 11o, 11n, spec 11 horror pass)

Saved verbatim from the user's message of 2026-11-14 so each task can read the authoritative text. Order: finish the current step; Part A (11m, 17, 11o); Part B (11n-a to 11n-d); Part C (new spec 11, H1 to H7); then spec 10 where it was left.

Same rules throughout: read the design bible first and update it when a system changes; a kiro-log entry per task; lint, build and unit tests pass; commit locally after each task or sub-step, never push; decisions made without the user go under "Decisions made unattended" in the log.

Art comes from Claude, not from Kiro. Claude builds the models, rigs, animations and images in Blender. Where a file listed here isn't in the repo yet, build the system against a clearly marked placeholder, keep going, and list what's waiting at the end. Never ship your own stand-in art as final.

At the very end, give one summary: what was done per part, what wasn't verified, and every art file still waiting on Claude (with paths).

---

## Part A. Small playtest fixes (spec 09)

### 11m. Unknown recipes say where to look; bench stock uses the models

**1. Where to find what's missing.** An undiscovered recipe can stay "???" with a silhouette, but it must tell the player where its missing ingredients come from. Today the tooltip only says "Pick up one of each ingredient to learn this recipe", and the missing ingredient shows as "???" with no hint.

- Pure helper: add `itemSources(itemId)` in `src/game/systems/`. It works only from the data: `lootTables.ts` (grave mounds, coffins, dug-grave loot, elites, the merchant), `zones.ts` FIXED_SPAWNS and SPAWN_POINTS, the hut shelf, and the merchant's stock. It returns a short list of places in plain words, e.g. "dug from grave mounds", "in coffins on the grounds", "on the hut shelf", "sold by Silas at dawn".
- Unit-test that every material used by any recipe has at least one source. If one has none, that is a bug: report it.
- Each missing ingredient shows its source under the "???", for example "??? · dug from grave mounds, found in coffins". The ingredient itself stays unnamed until it's held.
- The tooltip of an unknown recipe reads like: "??? Needs 2 ingredients. You have: Cloth. Still to find: something dug from grave mounds or found in coffins."
- A "Mark on map" button on the row (keyboard: M on a focused row) drops a map pin (11l) on the nearest source of the first missing ingredient. Skip places already looted or dug today. If there's no reachable source today, show "None left today. Try again tomorrow" instead of a pin.
- Known recipes with a missing ingredient (like Bandage, "Cloth 1/2, need 1 more") show the same "Found: …" line under the count.
- Keep it short: at most two places per ingredient, nearest first. The text sits in the recipe card and the tooltip, readable at 800x600 with the plain-font setting.

**2. Bench stock uses the models.** The material piles on the workbench top (Workbench.tsx, the Instances of boxGeometry around line 310) are still coloured boxes; the cream and yellow blocks in the user's screenshot are these. Draw each pile with the item's Blender model, as the recipe ghost already does with GroundItem and benchScale, keeping the ember glow on craftable and highlighted piles (emissive on the model's material, no light).

- The missing-ingredient outline in the recipe ghost can stay a wireframe, but make it the item's silhouette (the model in flat dark material) rather than a box, so the shape hints at what's missing.
- Search for any other boxGeometry or cylinderGeometry standing in for an item and give it the model too. Leave building parts, fences and UI alone. List what you changed.

Tests:
- Unit: itemSources covers every recipe material; the tooltip text for a known and an unknown recipe; Mark on map picks the nearest unlooted source.
- Browser: open the bench with an unknown recipe and check the source text shows; press Mark on map and check a pin appears on the compass; screenshot the bench showing the model piles at 1280x720 and 800x600.

### 17. Controls hint at the bottom left (rewrites spec 09 task 17, B11 movement hint; read design bible §11 first)

The user wants the bottom-left of the screen to tell the player which keys move, sprint and charge.

What it shows. A small panel in the HUD's parchment-on-dark style, just above the health bar and the oil gauge, with no overlap. One line per action, each a key cap plus a word:
- W A S D Move
- Shift Sprint, with the stamina bar named beside it (see below)
- Hold V Charge a heavy swing. Show this line only while a weapon that can charge is in hand (the wood axe and silver sabre, from heavyMelee.ts). With any other weapon, leave it out rather than show a key that does nothing.

Keys come from the player's bindings, read live from settingsStore (default W A S D, Left Shift, V), so a rebound key shows correctly. Write key names readably: "Shift", not "ShiftLeft"; "Mouse 2", not "Mouse2".

When it shows:
- From the end of the intro.
- Each line fades out (a steady fade with Flashing lights off) once the player has used that action: moved about 10 m, sprinted for 2 s, and charged one heavy swing. When all its lines have faded, the panel is gone.
- The charge line comes back the first time an axe or sabre is equipped, until it has been used once.
- A new setting, "Show control hints" (on by default), can hide or bring back the whole panel. Turning it back on shows every line again.
- Hidden during menus, the workbench view, the big map, examine, cutscenes and endings.
- Remember which lines were used in the save. It does not come back on Continue unless the setting is turned back on.

Stamina bar: the plain bar at the bottom centre has no label. Add a small "Stamina" caption, or a run icon with an accessible name, so the Sprint line's meaning is clear.

Rules and data: the hint lines (action, word, condition, how to clear) go in `src/data/controlHints.ts`. The show and clear logic is pure, in `src/game/systems/controlHints.ts`. The texts must stay inside the panel at 800x600 with the plain-font setting.

Compass bug in the same screenshot: the objective marker's distance ("19 m") is drawn on top of the "Hut" label when both point the same way. Labels that would overlap should stack on a second row or shift aside; never draw one over another. Add a unit test for the layout, and a screenshot with the hut and the objective in the same direction.

Tests:
- Unit: rebound keys show; the charge line appears only with the axe or sabre; each line clears after its action; the setting brings them back; save and restore.
- Browser: start a run and see the panel after the intro; walk and sprint and see those lines fade; equip the axe and see the charge line, charge once and see it go; confirm no overlap with the health bar, oil gauge, hotbar or captions at 1920x1080, 1280x720 and 800x600. Take screenshots.

### 11o. Objective hint fits where you are; clue outline fits the clue

**1. The hint matches the player's distance.** The objective tracker's second line said "E to pick up the oil on the table" while the player was nowhere near the hut. A hint that names a key or an object in reach only makes sense in reach.
- Each objective rule gets two hint texts: a near one (the key and the action, as today) and a far one that says where to go, e.g. "Go to the hut" or "Head for the chapel".
- Show the near hint only within about 6 m of the target and in the same building (inside the hut, chapel or catacombs counts as different from outside). Otherwise show the far hint. Reuse objectiveAim and the hut-door logic from task 8 to pick the place name.
- Keep the switch steady: use a small hysteresis (near at 6 m, far again at 8 m) so it doesn't flicker on the edge.
- Pure logic in the objective system; texts in data. Unit-test near, far, the inside/outside case and the hysteresis.

**2. The clue outline fits the clue.** The highlight around a clue spot is a big wireframe box much larger than the object, and from some angles it looks like a debug outline.
- Replace it with an outline that hugs the clue's model: the clue mesh drawn again slightly larger in a flat emissive colour behind it (inverted-hull), or a soft ground ring under it. No box, no wireframe.
- Size it from the model's bounds, not a fixed box. It fades in within about 4 m and out after the clue is examined.
- This ties into 11n-d, where each clue gets its own props/clue-<clueId>.glb; make the outline follow whichever model is shown.
- Search for any other wireframe box used as a highlight and treat it the same way (the recipe ghost silhouette in 11m already covers the bench).
- Browser check: screenshot a clue spot from near and far, at 1280x720.

---

## Part B. Scenery swap (spec 09, 11n)

A follow-up from the user's playtest. Items float, there's no table, and the chapel, hut and catacombs are still primitive boxes or stock Kenney pieces. Claude has built every one of them in Blender, so don't model anything; swap the files in. Split into 11n-a to 11n-d; commit locally after each sub-step.

### What's there
All files are Draco GLBs with vertex colours. Load them with `useGLTF(url, DRACO_PATH)` and `<Clone>` (as GraveyardScene.tsx does), and add them to preloadModels.

Each GLB has a JSON beside it with the same name. The JSON holds: `boxes` (colliders: centre, half extents, rotY, in the model's space); `anchors` (light spots, pivots and surfaces); `surfaces` (heights things rest on).

The generators are in tools/blender/ (sclib.py is the shared toolkit). Previews are in C:\David\previews\scenery\ and C:\David\previews\chapel\.

| File | Space | Replaces |
|---|---|---|
| scene/chapel-interior.glb | chapel-local (origin CHAPEL_CENTER) | the Kenney altar and candles, the flat window boxes, the visible floor slab, every primitive inside |
| scene/chapel-exterior.glb | chapel-local | every visible wall Slab, the front and vestry frames, GableRoof, the belfry boxes, the Kenney pillar-large buttresses and cross |
| scene/hut.glb | hut-local = world | every visible hut Slab, the floorboard box, the roof, the window boxes, the table meshes |
| scene/catacombs.glb | world | the catacomb brick-wall panels and the visible Blocks (floor, ceiling) |
| props/workbench.glb | bench-local (top 0.86, back toward -Z) | BenchModel's meshes (keep its collider) |
| props/lamp-post.glb | post-local, lamp arm toward +Z | Kenney lightpost-single (keep LAMP_POSTS and their rotations; put the light at anchor light) |
| props/coffin-broken.glb | coffin-local | Kenney coffin-old |
| props/gate-catacombs.glb (3.3 x 2.2), props/gate-mausoleum-row.glb (4.3 x 4.0) | gate-local, bottom centre, plane z = 0 | the iron-fence panel runs in Gate (one model per gate, lifted as a whole by useLift) |
| props/iron-railing.glb | one 1.5 m panel, post at -X | the avenue rails' iron-fence (panelRun keeps working; add one closing post) |
| props/ossuary-door.glb | door-local, bottom centre | OssuaryDoor's slate box and bars |
| props/grave-mound.glb, props/grave-dug.glb | mound-local, head (cross) at -Z | Mound in GraveMounds.tsx (both states) |
| props/merchant-cart.glb | cart-local, faces +Z | cartWood, cartIron and bulb in Merchant.tsx (Silas stays; the lantern light goes at anchor lantern) |
| props/statue-mourner.glb | faces +Z | Statue in ScareProps.tsx (the turn logic stays) |
| props/scare-door.glb | hinge at the origin, leaf along +X | Door in ScareProps.tsx |
| props/candle-stub.glb | origin at the base | the candle cylinder in CandleCluster (the animated flame stays, at y 0.3) |
| props/grave-hand.glb | origin at ground level | GraveHand |
| props/woodpile.glb | pile-local | Logs in WeaponPickups.tsx; put the axe at anchor axe-rest |
| props/lodge-table.glb (top 0.8) | | the shotgun Shelf |
| props/sabre-plinth.glb (top 0.3) | | the sabre's stone box |
| props/vending-machine.glb | faces +Z | new; place it at hut (2.83, 0, 1.85), rotationY -PI/2 (used by the horror pass, H6) |
| props/bat-perched.glb, props/bat-flying.glb | | new (used by the horror pass, H4) |
| props/clue-<clueId>.glb (9 files) | clue-local | Prop in ClueSpots.tsx: pick the model by clueId instead of the three generic shapes |

For the revolver, drop the Shelf: it now rests in the chapel cupboard (see 11n-a).

### 11n-a. Chapel inside and out
Mount both GLBs in the chapel-building group.
- Keep every wall, ceiling and door collider. Make the old Slabs invisible, or collider-only.
- The new walls have real window, door and vestry openings, and the interior's leaded glass sits in them.
- Remove the old visuals: the door and vestry frames, the window glass boxes, the Kenney pillars, GableRoof, the belfry meshes, the cross, the Kenney altar and candles, and the visible floor slab in Chapel.tsx (keep its collider).

Bell. The mesh chapel-ext-bell pivots at anchor bell-pivot. Swing it a few degrees when the dusk bell rings (the existing bell sound). Put the door lantern light at anchor door-lantern-light.

Colliders:
- Add the interior's boxes (pews, lectern, font, cupboard, altar) from chapel-interior-colliders.json.
- Add the exterior's 14 buttress boxes from chapel-exterior.json.
- None of them may block the centre aisle (|x| < 0.7), either door, the altar trigger at z 4.5 or the congregation points.
- Check that zombie pathing still reaches the altar and the vestry. If a pew blocks a path, shorten its collider; don't move the pew.

Stair cover. Mesh chapel-stair-cover (x −0.65..0.65, z 4.75..5.85) hides when the catacombs gate opens (the whistle at the altar), so the floor doesn't cover the stair.

Seat the chapel items on their surfaces:

| Spot | Rests on | Item y (chapel-local) |
|---|---|---|
| fx-page-5 | lectern, book rest 0.97, tilted 14° toward the door | 0.98; tilt the page to match |
| chapel-font loot | font lid 0.88 | 0.89 + half its height |
| chapel-pews loot | west pew seat 0.40 | 0.41 + half height |
| CHAPEL_CUPBOARD_POSITION (revolver) | cupboard shelf 0.88; cupboard centred at world (7.74, 7.6), shelf 0.95 wide (along z) x 0.4 | 0.89 + half height, inside the cupboard |

Hymn board. The east-wall board reads 4 · 19 · 2 · 41 · 23. Check this against the stage 3 Hymn Board puzzle in cases.ts and docs/case-design.md.
- If the puzzle's numbers differ, don't edit the GLB; report it and Claude will rebuild the board.
- If the puzzle's interactable isn't placed yet, place it at world [12.47, 1.75, 8.7], facing west.

### 11n-b. Hut
Mount hut.glb. Keep the wall colliders and make the Slabs collider-only. Remove the floor box, the roof, the window boxes and the table meshes.

Colliders. Add the boxes from hut.json: east table (same as today), west table, stove, cot, barrel, rain barrel, log stack, and the vending machine footprint.

The workbench becomes props/workbench.glb at the same position. Keep its collider and the material-pile placement: the top is still at 0.86 and the clear area is listed in the JSON.

Seat the hut items. Surfaces are at 0.78:

| Spot | Where | Rests on |
|---|---|---|
| hut-shelf | (1.8, ?, −1) | east table |
| fx-page-1 | (2.6, ?, −1.3) | east table |
| POWDER_TIN_HUT | (−1.8, ?, −1) | the new west table (it had nothing under it) |

Lights. The warm pointLight already matches the new hanging lantern (anchor hanging-lantern). Add a small ember light at stove-glow only if the frame budget allows. No other new lights.

Elias's boots clue at (−2.2, 0, 1.6) sits in front of the new cot. Use clue-hut-boots.glb.

### 11n-c. Catacombs and the gates
Mount catacombs.glb with no transform.
- Keep the corridor's floor, wall, ceiling and end-wall colliders.
- Remove the brick-wall instances and make the floor and ceiling Blocks invisible.
- The glb adds an entrance portal and an earth mound over the tunnel. Add the portal pier and wing-wall colliders from catacombs.json.

Seat the catacomb items. All four float today. Use the new surfaces; exact targets are in catacombs.json → surfaces.move-items:

| Spot | Today | New spot (rests on) |
|---|---|---|
| cat-wall-a | [24.5, 1, 45] | (23.87, 0.95, 45) west ledge |
| cat-wall-b | [25.5, 1, 50] | (26.13, 0.95, 50) east ledge |
| cat-wall-c | [24.5, 1, 55] | (23.87, 0.95, 54.9) west ledge |
| fx-page-4 | [25, 1, 52] | (24.2, 0.78, 52.6) the stone bier |
| fx-shroud | — | (24.35, 0.78, 53.4) the bier |
| fx-heart | — | (25, 0.78, 58) the reliquary altar |

Add the ledge, bier and altar colliders from the JSON.

Candle anchors (candle-0..5): add at most two dim warm lights without shadows, and only if the frame budget allows. The flames are emissive.

Gates. Each corridor gate becomes its own model, lifted whole by useLift. The ossuary door uses ossuary-door.glb. The avenue rails use iron-railing.glb.

### 11n-d. Props everywhere else
Swap each row of the table above. Keep every existing collider and interactable. Where a prop's JSON has a collider and the game has none (statue, woodpile, lodge table, clue notice post), add it.

### Realism: what the Blender models already do, and what the renderer should add
The models carry their realism in their vertex colours and geometry, so don't override their materials with flat colours. In the models:
- Masonry: coursed stone with bevelled block edges and per-block tone variation. Moss grows on up-facing surfaces and near the ground, rain streaks run down walls, and grime is darker near the ground.
- Wood: grain runs along each board. Boards are weathered grey outside and warm inside. Clapboard laps cast shadow lines. Shingles and slates have random tilt, slipped and missing pieces.
- Iron: rust gathers low and in patches.
- Small parts: real geometry for mouldings, archivolts, hood moulds, label stops, gutters and downpipes, hinges, bolts and studs.
- Light sources: light-emitting parts (candle flames, lantern glass, window glass, stove ember, bat eyes) use emissive materials, and the JSON gives an anchor for any real light.
- Windows: hut windows are two one-sided panes, lit amber outside and dark night glass inside, so they don't glow like lightboxes from indoors.
- Materials are single-sided (all meshes are closed) and Draco-compressed.

To make that show, in the renderer:
- Tone mapping. Use AgXToneMapping (or ACES) with sRGB output; the previews were judged under AgX.
- Ambient occlusion. Add an SSAO or N8AO pass at low intensity, so pews, niches, bone walls and the clapboard read with depth. If you add only one effect, make it this one.
- Bloom. Add selective bloom on emissive materials only (threshold about 1), so flames and lanterns glow without washing the scene.
- Shadows. The lantern spot and the moon cast shadows. Give the moon a tight shadow camera around the player, with PCF soft shadows. Small fills cast none.
- Fog. Keep the existing fog. Interiors (chapel, hut, catacombs) use a denser, warmer fog volume or a lower fog.far, so the far end of a room falls into darkness.

Benchmark everything with the GPU perf project: before and after for each sub-step; report the frame time in the chapel, the hut, the catacombs and the open grounds; stay inside the budget in the design bible. If an effect breaks the budget, turn it off at the "Low" graphics setting rather than removing it.

Triangle counts (for the budget): chapel exterior 75k; catacombs 93k; hut 33k; chapel interior 23k; props under 5k each.

### Tests
Unit:
- every item spot listed above is within 0.03 m of its surface, measured from the model's bounds;
- every JSON loads;
- no collider sits in the chapel aisle (x 9.3..10.7, z −1..9.5) or the hut's spawn-to-bench path (|x| < 0.7, z −1.8..3);
- the catacomb corridor keeps at least 1.6 m clear width everywhere.

Browser (screenshots at 1280x720):
- Chapel from the door, from the altar, and the cupboard with the revolver on its shelf.
- Walk the aisle to the altar and out through the vestry with no snag.
- Chapel outside from the path, and the bell swinging at dusk.
- Hut inside, facing each wall, with page 1 and the powder tin resting on tables; hut outside.
- Catacombs: the portal, the bone walls, each ledge item, the bier, and the heart on the altar.
- Whistle open: the stair cover is gone.
- Each swapped prop in place: lamp post at night, gate lifting, statue turning, scare door, merchant cart.
- GPU perf before and after.

List anything you couldn't seat or that needed a change to the data.

---

## Part C. Horror pass (new spec 11)

The user played the game and wants it scarier and easier to read: real screen jumpscares; more kinds of creatures with different traits; Halloween touches that make you uneasy; zombies that look like horror-game zombies; small info dots in the journal that explain how things work; a coin-op vending machine in the hut; detailed first-person hands, with a more realistic lantern light.

Make this spec 11-horror-pass in .kiro/specs/11-horror-pass/ (requirements, design, tasks), with the tasks below. Design bible first, and add a §12 "Horror pass" to it; a kiro-log entry per task; lint, build and unit tests pass; commit locally after each task, never push. Decisions made unattended go under "Decisions made unattended".

Claude makes the art in Blender (models, rigs, animations, the jumpscare images). The paths below are fixed. Where a file isn't there yet, build the system against a clearly marked placeholder, keep going, and list what's waiting. Never draw your own stand-in art and ship it as final.

### H1. Screen jumpscares
What the user wants: a scary face that slams onto the screen instantly and sticks there. A zombie face comes up from the bottom edge; a ghost comes down from the top edge.

How it plays:
- ScreenScare overlay above the HUD. The image covers about 85% of the screen height and is anchored to the bottom or top edge.
- Timing: In: 70 ms (no ease-in; it arrives at once), with a 1-frame white flash. Stick: 550–800 ms, with a sharp camera shake that decays, a fast scale jitter (1.00 → 1.04) and a chromatic split on the image edges. Out: a 250 ms slide back and fade.
- The world under the face goes to 30% brightness for the hold.
- Audio: each scare has a sting. Use a layered sting: a sharp attack plus a low thud, and a scream or wail. Add them to the sound list and use placeholders until Claude supplies the files. Duck all other audio by 70% for the hold.
- Triggers are earned, never random noise:
  - Pale Crawler ambush (H2): when one bursts out within 1.5 m in front of the player → bottom zombie face. The player then takes the crawler's grab damage as normal.
  - Hollow Bride (H2): when she reaches the player → top ghost face, then the oil drain.
  - Scripted moments, one each, at most once per save: opening a particular broken coffin at night 2; looking out of the hut's west window at night 3 (a face presses against the glass from the bottom); the ossuary door's grille the first time the player looks through it.
- Cooldown: at least 3 minutes between screen scares. Never during menus, the journal, the workbench view, the big map, examine, cutscenes or endings.
- Setting: "Jumpscares: Full / Reduced / Off", defaulting to Full. Reduced: no flash, no shake, no chromatic split, quieter sting; the face is still shown. Off: none of it. With "Flashing lights" off, the flash and the chromatic split are always removed.
- Art (from Claude): transparent .webp images, 2048 px tall, under 300 KB each: public/assets/scares/face-zombie-1.webp, face-zombie-2.webp, face-crawler.webp (from the bottom); public/assets/scares/ghost-bride-1.webp, ghost-bride-2.webp (from the top). Pick at random from the matching set, never the same image twice in a row.
- Rules and data: scare definitions in src/data/screenScares.ts; the cooldown, trigger and choice logic (pure) in src/game/systems/screenScares.ts.

### H2. New creatures, each with its own traits
Today's roster is shambler, lurker, wailer, bloater, brute and Father Crane. Add three original creatures, each with a clear role. Every number below is a starting point; tune it against the design bible's difficulty curve, and log what you changed.

| Creature | Look (Claude's model) | Speed | HP | Behaviour | Weakness | First night |
|---|---|---|---|---|---|---|
| Pale Crawler (crawler) | an emaciated grey corpse dragging itself on its arms, jaw hanging | 1.2 m/s crawling, 6 m/s for a 0.6 s lunge | 35 | Waits hidden under grave mounds and broken coffins (spawned at those spots, invisible until it moves). Bursts out when the player passes within 2 m and grabs for 8 damage (H1's bottom scare). Its low body ducks horizontal swings: hit it with a downward swing or a shot. | fire (lantern trap), any gun | 2 |
| Hollow Bride (bride) | a drifting ghost in a torn veil and wedding dress, feet never touching the ground | 2.2 m/s drift | 60 | Passes through fences and gravestones, but not the chapel or hut walls. Only visible inside the lantern's cone or within 3 m. When she touches the player she drains 20% lantern oil (H1's top scare), then vanishes and returns 30–60 s later. She can't hurt your health. | holy water, silver sabre, salt circle (she can't cross it). Lead passes through her. | 3 |
| Corpse Hound (hound) | a rotting, hairless mastiff with exposed ribs | 5.5 m/s | 45 | Comes in packs of 2–3. They circle at 4–6 m, then one darts in for 10 damage while the others hold. A lantern flare or a gunshot scatters the pack for 4 s. | guns, heavy swings | 4 (stage 2 onward) |

- Add each to: enemies.ts (EnemyId, ENEMY_MAP, ENEMY_LOOKS), the wave tables, and the elites list where it makes sense. Not the Bride: she is a haunting, not a wave enemy. Spawn at most one Bride at a time, from stage 2.
- Bestiary: a "Creatures" page in the journal shows each creature once it's been seen: its sketch, a short field note, and "What works".
- Keep it fair: each creature has a readable tell before it attacks. The crawler has a soil shiver and a wet click. The Bride lets out a cold breath, the lantern flame bends, and a faint humming plays. The hounds growl from the dark before they circle. Add sounds and captions for each.

### H3. Zombies that look like horror-game zombies
Claude is building original realistic zombie models in Blender, in the style of modern survival-horror games: grey-green, mottled skin with exposed tendons; torn burial clothes from 1891 (a farmhand, a woman in a burial gown, a gravedigger, a mourner in a top hat); cloudy eyes, broken teeth; a shambling gait.

The contract, so the swap is only a file change:
- public/assets/models/enemies/zombie.glb (base, with several looks), zombie-brute.glb, plus the new crawler.glb, bride.glb and hound.glb.
- Same clip names as today: Idle, Walk, Run, Crawl, Attack, Lunge, Threaten, HitReact, Death. The hound and the Bride swap Crawl for their own movement clip.
- One skinned mesh per creature, under 15k triangles. Several looks sit in one file as named mesh variants (look-0..3), shown one at a time.
- Prepare the code now: variant selection per spawn (deterministic from the uid); a per-variant tint that's now optional; the new ids in ENEMY_LOOKS.
- Until the files arrive, keep using today's models for the new ids, scaled and tinted, and mark them as placeholders.

### H4. Halloween unease: bats that watch you
- Bats perched on headstones: 8–12 at night, from stage 1, sitting on the tops of headstones and mausoleum roofs. Take positions from the graveyard collider box tops: graveyard-colliders.json, boxes 0.6–1.6 m tall.
- Model: props/bat-perched.glb. The "head" and "eyes" meshes turn on Y toward the player, eased and up to 120°, while the player is within 14 m. That's the "staring" the user wants.
- The eyes glow faintly (emissive). Add no light.
- At most one chitter sound every 20 s, and quiet.
- They take off: when the player comes within 3 m, or fires a gun within 10 m, the bat swaps to props/bat-flying.glb. Its wings flap about the wing-left and wing-right pivots, about 8 flaps a second. It flies off along a curved path, fades out after 6 s, and comes back to a new grave after 2 minutes.
- Optional, if the frame budget allows: a flock of 15–20 flying bats that bursts out of the chapel belfry when the dusk bell rings. Use instancing with simple wing flapping in the vertex shader.

### H5. Info dots in the journal
A small circled i sits next to each journal section heading and the key HUD panels. Hovering it (or focusing it with Tab; on touch, tapping it) shows a short tooltip on how to play, not the story. Use the HUD's parchment style, at most 2 sentences, readable at 800x600 with the plain font.

Write each text from what the code actually does. The drafts below are written from the current design; check each against the systems and correct it rather than shipping it as written:
- Case board: "Drag a red string between two clue cards you think are connected. Each true link lowers the Curse; answer the case at the chapel altar at dusk or night."
- Clues: "Clues are added when you examine marked places and read headstones. Some only make sense once you carry the parish ledger."
- Curse meter: "The Curse keeps the nights going. It drops with every true link on the case board and ends when the case is answered."
- Hints: "Stuck? A hint costs 5, then 10, then 20 coins and points you at the next clue."
- Map: "Press M for the big map. Click to drop up to 3 pins; pins show on the compass and the minimap."
- Recipes: "Unknown recipes show where their missing ingredients are found. Pick up one of each ingredient to learn the recipe."
- Satchel / relics: "Relics are needed for the final rite. They are found, never bought."
- Lantern oil: "Oil burns while the lantern is lit. Refill it from the satchel or at the bench; with no oil you're in the dark."
- Stamina: "Sprinting uses stamina; it refills when you walk or stand still."
- Bestiary (H2): "Each creature you've seen, with what works against it."
- Coins: "Coins come from graves, coffins and the dead. Spend them on hints, with Silas at dawn, or at the hut's vending machine."

Implementation: texts go in src/data/infoTips.ts, keyed by section. One InfoDot component, with aria-describedby and an Escape key that closes the tooltip. A setting "Show info dots" (on). Tests: every journal section and the listed HUD panels have a tip, and each tip is at most 2 sentences.

### H6. The hut's vending machine
"Hollowmere Automatic Dispenser": a coin-op cabinet in the style of the 1890s. Model: props/vending-machine.glb at hut (2.83, 0, 1.85), rotationY −PI/2. Its colliders are in hut.json and the machine's JSON.

- Use: press E to open a small panel in the merchant's style. One row per item shows the price, today's stock left, and what it does. Buying: the coin clinks (sound); that row's brass handle pulls out about 5 cm and springs back (anchors handle-0..4); the goods "drop" into the tray. It takes about 1.2 s, during which you are not protected. It works by day and by night.
- Stock: only convenience items. No relics, key items, journal pages, recipes, clues, holy water or silver: exploring stays the way to get what matters. Prices sit a little above Silas's (he's only there at dawn), and stock resets at dawn:

| Row | Item | Price | Per day | Notes |
|---|---|---|---|---|
| 0 | Revolver Cartridges x6 | 12 | 2 | needs the revolver |
| 1 | Shotgun Shells x4 | 14 | 2 | needs the shotgun |
| 2 | Lamp Oil x1 | 5 | 3 | |
| 3 | Kola Tonic x1 (stamina) | 18 | 1 | |
| 4 | Brisk Draught x1 (new) | 15 | 1 | +25% move speed for 60 s; can't stack. New consumable, icon and model from Claude: items/brisk-draught.glb. Use a placeholder bottle until then. |
| — | Bandage x1 | 7 | 2 | shares row 2's handle visually |

- Marquee light: the marquee glass is emissive; add one small warm light at marquee-light only if the budget allows. Show a "Sold out" card when a row is empty.
- Data: in src/data/vending.ts, pure rules in src/game/systems/vending.ts.
- Unit tests: prices, stock reset at dawn, needs-weapon rows hidden, no forbidden item can ever be stocked, coins never go negative.
- Update the H5 coins tip.

### H7. Detailed hands, and a more realistic lantern
Hands (model from Claude): public/assets/models/viewmodel/hands.glb, rigged, with clips: Grip-Pistol (revolver); Grip-Haft (shovels, axe, club, sabre); Grip-Long (shotgun, two-handed); Lantern-Hold (left hand around the lantern's bail); Throw, Reload-Revolver, Reload-Shotgun; Swing-Light, Swing-Heavy. The hands have work-worn skin, dirt under the nails, and a wool coat cuff with a frayed edge. Also viewmodel/lantern.glb: a caged iron lantern with separate glass and flame meshes.

Today the viewmodel shows only the weapon. Change it to:
- Right hand holds the weapon, in the pose for its grip class.
- Left hand holds the lantern at about hip-to-chest height, swaying with walking (follow-through on turns, a lag of about 80 ms). It lifts a little when the player raises it to look (if there's a lantern-raise action) and lowers when sprinting.
- Shotgun: the left hand moves to the fore-end. The lantern hooks onto the belt and its light comes from the hip, pointing forward and a little down. Tell the player once with a caption: "Lantern hooked to your belt".
- Throwing and two-handed heavy swings: the left hand lets go of the lantern for the swing and catches it again. The lantern hangs from the wrist strap during the swing.
- Until hands.glb arrives, keep the current viewmodel and make the code ready for the new one.

A more realistic lantern light:
- Light origin: the light comes from the lantern glass in the left hand, not from the camera. As the lantern sways, the shadows move.
- Spot: the main spot is shadow-casting and points forward from the lantern.
- Use a cookie (SpotLight.map) of the lantern cage's bars, so faint bar shadows fall on nearby walls. Claude supplies public/assets/textures/lantern-cookie.png; until then use a soft round placeholder.
- Fill: a small fill point light (no shadow) with a short radius.
- Colour: about 1900 K, like a candle or kerosene flame (#ffb46b).
- Flicker: driven by layered noise, not a sine wave. Slow breathing plus quick gutters, with occasional dips of up to −25%. The flame mesh scale and the glass emissive follow the same signal.
- Oil level: brightness and range follow the oil level. Below 15% oil the light gutters harder and turns redder; at 0 it goes out with a small last flare.
- Movement: sprinting and wind gusts make it flicker more. The Bride's approach bends the flame and dims the light by 30% (H2).
- Bloom on the flame and glass only (see 11n's renderer notes).
- Performance: benchmark before and after with the GPU perf project. The lantern's shadow map stays at 1024 or below, and the "Low" setting turns the cookie off.

Realism features to keep consistent (from the Blender side): weathering lives in the vertex colours (moss on up-facing surfaces and near the ground, rain streaks, darker grime low down, rust in patches, wood grain along the board); real bevels and geometry for details, no flat boxes; emissive materials for anything that glows, with an anchor for any real light; one-sided panes where inside and outside must differ; Draco compression. So don't override model materials with flat colours. Keep tone mapping on AgX or ACES, and keep the subtle AO and selective bloom from 11n.

### Tests (whole spec)
Unit: scare cooldown and gating, and the setting's three modes; creature data and traits; the Bride can't cross salt and can't be hurt by lead; the crawler ducks horizontal swings; vending rules; info tips complete; the bat state machine (perched → flee → return).

Browser (screenshots at 1280x720 and 800x600): each screen scare at Full and Reduced, showing the face from the bottom and the ghost from the top; a crawler ambush; the Bride seen only in the lantern cone; the hound pack circling and scattering at a gunshot; a bat turning its head as you walk past, then taking off; hovering each info dot; buying from the vending machine (handle pull, coins drop, stock count); the hands with each grip class, the lantern on the belt with the shotgun; the lantern's cage shadows on the hut wall; GPU perf before and after.

At the end, list everything still waiting on Claude's art (paths), so the user can see it at a glance.