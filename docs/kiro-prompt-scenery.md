# Kiro prompt: swap in the Blender scenery (chapel inside and out, hut, catacombs, props)

Paste everything below the line into Kiro. This replaces `kiro-prompt-chapel-interior.md` (11n), which it includes.

---

A follow-up from the user's playtest. Items float, there's no table, and the chapel, hut and catacombs are still primitive boxes or stock Kenney pieces. Claude has built every one of them in Blender, so **don't model anything**; swap the files in.

Add this to `.kiro/specs/09-playtest-fixes/tasks.md` as **11n (scenery swap)**, split into the sub-steps below. Do it next: finish the step you're on and commit it, then do 11n. Same rules as always:
- design bible first;
- a kiro-log entry;
- lint, build and unit tests pass;
- commit locally after each sub-step, never push.

## What's there

All files are Draco GLBs with vertex colours. Load them with `useGLTF(url, DRACO_PATH)` and `<Clone>` (as `GraveyardScene.tsx` does), and add them to `preloadModels`.

Each GLB has a JSON beside it with the same name. The JSON holds:
- **`boxes`**: colliders (centre, half extents, rotY, in the model's space);
- **`anchors`**: light spots, pivots and surfaces;
- **`surfaces`**: heights things rest on.

The generators are in `tools/blender/` (`sclib.py` is the shared toolkit). Previews are in `C:\David\previews\scenery\` and `C:\David\previews\chapel\`.

| File | Space | Replaces |
|---|---|---|
| `scene/chapel-interior.glb` | chapel-local (origin `CHAPEL_CENTER`) | the Kenney altar and candles, the flat window boxes, the visible floor slab, every primitive inside |
| `scene/chapel-exterior.glb` | chapel-local | every visible wall `Slab`, the front and vestry frames, `GableRoof`, the belfry boxes, the Kenney `pillar-large` buttresses and `cross` |
| `scene/hut.glb` | hut-local = world | every visible hut `Slab`, the floorboard box, the roof, the window boxes, the table meshes |
| `scene/catacombs.glb` | **world** | the catacomb `brick-wall` panels and the visible `Block`s (floor, ceiling) |
| `props/workbench.glb` | bench-local (top 0.86, back toward -Z) | `BenchModel`'s meshes (keep its collider) |
| `props/lamp-post.glb` | post-local, lamp arm toward +Z | Kenney `lightpost-single` (keep `LAMP_POSTS` and their rotations; put the light at anchor `light`) |
| `props/coffin-broken.glb` | coffin-local | Kenney `coffin-old` |
| `props/gate-catacombs.glb` (3.3 x 2.2), `props/gate-mausoleum-row.glb` (4.3 x 4.0) | gate-local, bottom centre, plane z = 0 | the `iron-fence` panel runs in `Gate` (one model per gate, lifted as a whole by `useLift`) |
| `props/iron-railing.glb` | one 1.5 m panel, post at -X | the avenue rails' `iron-fence` (`panelRun` keeps working; add one closing post) |
| `props/ossuary-door.glb` | door-local, bottom centre | `OssuaryDoor`'s slate box and bars |
| `props/grave-mound.glb`, `props/grave-dug.glb` | mound-local, head (cross) at -Z | `Mound` in `GraveMounds.tsx` (both states) |
| `props/merchant-cart.glb` | cart-local, faces +Z | `cartWood`, `cartIron` and `bulb` in `Merchant.tsx` (Silas stays; the lantern light goes at anchor `lantern`) |
| `props/statue-mourner.glb` | faces +Z | `Statue` in `ScareProps.tsx` (the turn logic stays) |
| `props/scare-door.glb` | hinge at the origin, leaf along +X | `Door` in `ScareProps.tsx` |
| `props/candle-stub.glb` | origin at the base | the candle cylinder in `CandleCluster` (the animated flame stays, at y 0.3) |
| `props/grave-hand.glb` | origin at ground level | `GraveHand` |
| `props/woodpile.glb` | pile-local | `Logs` in `WeaponPickups.tsx`; put the axe at anchor `axe-rest` |
| `props/lodge-table.glb` (top 0.8) | | the shotgun `Shelf` |
| `props/sabre-plinth.glb` (top 0.3) | | the sabre's stone box |
| `props/vending-machine.glb` | faces +Z | new; place it at hut (2.83, 0, 1.85), rotationY -PI/2 (used by the horror pass, H6) |
| `props/bat-perched.glb`, `props/bat-flying.glb` | | new (used by the horror pass, H4) |
| `props/clue-<clueId>.glb` (9 files) | clue-local | `Prop` in `ClueSpots.tsx`: pick the model by `clueId` instead of the three generic shapes |

For the revolver, drop the `Shelf`: it now rests in the chapel cupboard (see 11n-a).

## 11n-a. Chapel inside and out

1. **Mount both GLBs** in the `chapel-building` group.
   - Keep every wall, ceiling and door **collider**. Make the old `Slab`s invisible, or collider-only.
   - The new walls have real window, door and vestry openings, and the interior's leaded glass sits in them.
2. **Remove the old visuals:** the door and vestry frames, the window glass boxes, the Kenney pillars, `GableRoof`, the belfry meshes, the cross, the Kenney altar and candles, and the visible floor slab in `Chapel.tsx` (keep its collider).
3. **Bell.** The mesh `chapel-ext-bell` pivots at anchor `bell-pivot`. Swing it a few degrees when the dusk bell rings (the existing bell sound). Put the door lantern light at anchor `door-lantern-light`.
4. **Colliders:**
   - Add the interior's boxes (pews, lectern, font, cupboard, altar) from `chapel-interior-colliders.json`.
   - Add the exterior's 14 buttress boxes from `chapel-exterior.json`.
   - None of them may block the centre aisle (|x| < 0.7), either door, the altar trigger at z 4.5 or the congregation points.
   - Check that zombie pathing still reaches the altar and the vestry. If a pew blocks a path, shorten its collider; don't move the pew.
5. **Stair cover.** Mesh `chapel-stair-cover` (x −0.65..0.65, z 4.75..5.85) hides when the catacombs gate opens (the whistle at the altar), so the floor doesn't cover the stair.
6. **Seat the chapel items** on their surfaces:

   | Spot | Rests on | Item y (chapel-local) |
   |---|---|---|
   | `fx-page-5` | lectern, book rest 0.97, tilted 14° toward the door | 0.98; tilt the page to match |
   | `chapel-font` loot | font lid 0.88 | 0.89 + half its height |
   | `chapel-pews` loot | west pew seat 0.40 | 0.41 + half height |
   | `CHAPEL_CUPBOARD_POSITION` (revolver) | cupboard shelf 0.88; cupboard centred at world (7.74, 7.6), shelf 0.95 wide (along z) x 0.4 | 0.89 + half height, inside the cupboard |

7. **Hymn board.** The east-wall board reads **4 · 19 · 2 · 41 · 23**. Check this against the stage 3 Hymn Board puzzle in `cases.ts` and `docs/case-design.md`.
   - If the puzzle's numbers differ, don't edit the GLB; report it and Claude will rebuild the board.
   - If the puzzle's interactable isn't placed yet, place it at world [12.47, 1.75, 8.7], facing west.

## 11n-b. Hut

1. **Mount `hut.glb`.** Keep the wall colliders and make the `Slab`s collider-only. Remove the floor box, the roof, the window boxes and the table meshes.
2. **Colliders.** Add the boxes from `hut.json`: east table (same as today), west table, stove, cot, barrel, rain barrel, log stack, and the vending machine footprint.
3. **The workbench** becomes `props/workbench.glb` at the same position. Keep its collider and the material-pile placement: the top is still at 0.86 and the clear area is listed in the JSON.
4. **Seat the hut items.** Surfaces are at **0.78**:

   | Spot | Where | Rests on |
   |---|---|---|
   | `hut-shelf` | (1.8, ?, −1) | east table |
   | `fx-page-1` | (2.6, ?, −1.3) | east table |
   | `POWDER_TIN_HUT` | (−1.8, ?, −1) | the **new west table** (it had nothing under it) |

5. **Lights.** The warm `pointLight` already matches the new hanging lantern (anchor `hanging-lantern`). Add a small ember light at `stove-glow` only if the frame budget allows. **No other new lights.**
6. **Elias's boots clue** at (−2.2, 0, 1.6) sits in front of the new cot. Use `clue-hut-boots.glb`.

## 11n-c. Catacombs and the gates

1. **Mount `catacombs.glb`** with no transform.
   - Keep the corridor's floor, wall, ceiling and end-wall colliders.
   - Remove the `brick-wall` instances and make the floor and ceiling `Block`s invisible.
   - The glb adds an entrance portal and an earth mound over the tunnel. Add the portal pier and wing-wall colliders from `catacombs.json`.
2. **Seat the catacomb items.** All four float today. Use the new surfaces; exact targets are in `catacombs.json` → `surfaces.move-items`:

   | Spot | Today | New spot (rests on) |
   |---|---|---|
   | `cat-wall-a` | [24.5, 1, 45] | (23.87, 0.95, 45) west ledge |
   | `cat-wall-b` | [25.5, 1, 50] | (26.13, 0.95, 50) east ledge |
   | `cat-wall-c` | [24.5, 1, 55] | (23.87, 0.95, 54.9) west ledge |
   | `fx-page-4` | [25, 1, 52] | (24.2, 0.78, 52.6) the stone bier |
   | `fx-shroud` | — | (24.35, 0.78, 53.4) the bier |
   | `fx-heart` | — | (25, 0.78, 58) the reliquary altar |

   Add the ledge, bier and altar colliders from the JSON.
3. **Candle anchors** (`candle-0..5`): add at most two dim warm lights without shadows, and only if the frame budget allows. The flames are emissive.
4. **Gates.** Each corridor gate becomes its own model, lifted whole by `useLift`. The ossuary door uses `ossuary-door.glb`. The avenue rails use `iron-railing.glb`.

## 11n-d. Props everywhere else

Swap each row of the table above. Keep every existing collider and interactable. Where a prop's JSON has a collider and the game has none (statue, woodpile, lodge table, clue notice post), add it.

## Realism: what the Blender models already do, and what the renderer should add

The models carry their realism in their vertex colours and geometry, so **don't override their materials** with flat colours. In the models:
- **Masonry:** coursed stone with bevelled block edges and per-block tone variation. Moss grows on up-facing surfaces and near the ground, rain streaks run down walls, and grime is darker near the ground.
- **Wood:** grain runs along each board. Boards are weathered grey outside and warm inside. Clapboard laps cast shadow lines. Shingles and slates have random tilt, slipped and missing pieces.
- **Iron:** rust gathers low and in patches.
- **Small parts:** real geometry for mouldings, archivolts, hood moulds, label stops, gutters and downpipes, hinges, bolts and studs.
- **Light sources:** light-emitting parts (candle flames, lantern glass, window glass, stove ember, bat eyes) use emissive materials, and the JSON gives an anchor for any real light.
- **Windows:** hut windows are two one-sided panes, lit amber outside and dark night glass inside, so they don't glow like lightboxes from indoors.
- **Materials** are single-sided (all meshes are closed) and Draco-compressed.

To make that show, in the renderer:
1. **Tone mapping.** Use `AgXToneMapping` (or ACES) with sRGB output; the previews were judged under AgX.
2. **Ambient occlusion.** Add an SSAO or N8AO pass at low intensity, so pews, niches, bone walls and the clapboard read with depth. If you add only one effect, make it this one.
3. **Bloom.** Add selective bloom on emissive materials only (threshold about 1), so flames and lanterns glow without washing the scene.
4. **Shadows.** The lantern spot and the moon cast shadows. Give the moon a tight shadow camera around the player, with PCF soft shadows. Small fills cast none.
5. **Fog.** Keep the existing fog. Interiors (chapel, hut, catacombs) use a denser, warmer fog volume or a lower `fog.far`, so the far end of a room falls into darkness.

Benchmark everything with the GPU perf project:
- before and after for each sub-step;
- report the frame time in the chapel, the hut, the catacombs and the open grounds;
- stay inside the budget in the design bible. If an effect breaks the budget, turn it off at the "Low" graphics setting rather than removing it.

**Triangle counts** (for the budget):

| Model | Triangles |
|---|---|
| chapel exterior | 75k |
| catacombs | 93k |
| hut | 33k |
| chapel interior | 23k |
| props | under 5k each |

## Tests

**Unit:**
- every item spot listed above is within 0.03 m of its surface, measured from the model's bounds;
- every JSON loads;
- no collider sits in the chapel aisle (x 9.3..10.7, z −1..9.5) or the hut's spawn-to-bench path (|x| < 0.7, z −1.8..3);
- the catacomb corridor keeps at least 1.6 m clear width everywhere.

**Browser** (screenshots at 1280x720):
1. Chapel from the door, from the altar, and the cupboard with the revolver on its shelf.
2. Walk the aisle to the altar and out through the vestry with no snag.
3. Chapel outside from the path, and the bell swinging at dusk.
4. Hut inside, facing each wall, with page 1 and the powder tin resting on tables; hut outside.
5. Catacombs: the portal, the bone walls, each ledge item, the bier, and the heart on the altar.
6. Whistle open: the stair cover is gone.
7. Each swapped prop in place: lamp post at night, gate lifting, statue turning, scare door, merchant cart.
8. GPU perf before and after.

List anything you couldn't seat or that needed a change to the data.
