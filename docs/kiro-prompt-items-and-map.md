# Kiro prompt: item models everywhere, and a big map with pins

Paste everything below the line into Kiro. If the scheduled run (`docs/kiro-prompt-scheduled.md`) is underway, it adds two tasks that go in front of the rest of that run; Kiro then carries on where it was.

---

Two new tasks from the user's playtest. Add them to `.kiro/specs/09-playtest-fixes/tasks.md` as **11k** and **11l** (after 11j, before 12). Do them next, before going on with any other open task, then continue the scheduled run from where it was. The same run rules apply: design bible first, a kiro-log entry per task, lint, build and unit tests pass, commit locally per task, never push.

## 11k. Every item uses its Blender model

The user found items with no real design: the journal pages, the lamp oil, and most pickups are placeholder shapes or borrowed Kenney props. Claude has made a model for every one of them. **31 new GLBs** are in `public/assets/models/items/`, named after the item ID:
- all 11 materials;
- both ammo types and Blessed Rounds;
- the 16 weapons, tools and consumables;
- `journal-page` (one model for all five pages);
- `parish-ledger`.

`docs/world-items.md` lists their sizes, triangles (230 to 9,600; 460 KB in all) and orientation. They follow the same conventions as the hero items: metres, centred, vertex colours, Draco.

1. **Data:** in `src/data/items.ts`, every item gets `model: assets/models/items/<id>.glb`. Journal pages 1–5 use `journal-page.glb`. Delete `BORROWED_MODEL`. Add a unit test that every item in `ITEMS` has a model file on disk.
2. **Use the model wherever the item is drawn in the world or the hand:**
   - ground pickups (`MaterialPickups` / `MaterialShape`): keep `MaterialShape` only as the Suspense fallback while the GLB loads;
   - fixed spawns: `TornPaper` becomes `journal-page.glb` and `LedgerBook` becomes `parish-ledger.glb`; the hut oil and anything on the hut shelf use their models too;
   - dug-grave loot and elite drops;
   - weapon pickups (`WeaponPickups.tsx`: axe, sabre, revolver, shotgun). The woodpile stays;
   - placed items (`LanternTraps.tsx`, `SaltCircles.tsx`, placed tallow candles);
   - the workbench recipe ghost (`RecipeGhost`): owned ingredients use their model; missing ones stay wireframe;
   - the examine view (it reads `model` already, so check that it now shows the new models);
   - the first-person held weapons (`Viewmodel.tsx`, `viewmodelWeaponGeometry.ts`). Put each weapon's grip offset, rotation and scale in data. Keep the swing and recoil animations, keep the lantern hand, and check no weapon clips the camera at 1280x720 and 800x600.
3. **Orientation:** as in `docs/world-items.md`.
   - Shovels have the grip at +Y.
   - The club, axe and sabre have the grip at −Y.
   - The guns point the barrel along +X.
   - Ground items lie flat.

   Do not rotate or scale the GLB files; set it in data.
4. **Performance:**
   - Load each GLB once (drei `useGLTF`, preloaded with the others).
   - Draw repeated pickups with `<Clone>` or instancing.
   - No new lights.
   - The `ember` vertex colour on candles and lanterns may get an emissive material in code. Do not add a light for it.
   - Report draw calls and `longestFrameMs()` on a 20 s walk before and after.
5. **Hover and cues:** the hover outline, rune and fade from 11c must still work on every new mesh. Collected items still fade their mesh (`useLingering`).
6. **Tests:**
   - Unit: every item has a model, and every held weapon has a grip transform.
   - Browser: screenshot a ground pickup of each material, the journal page in the hut, the oil, each weapon pickup and each held weapon into `e2e/screenshots/items/`. Check every model is visible at its spot and targetable.

## 11l. Big map on M with clickable pins

The user wants **M** to open a large map, and to click on it to drop pins that guide them. The pins show on the compass and the minimap too.

**The big map**
- **M opens it:** a full-screen overlay in the Journal map's pencil style, drawn with `mapDraw`.
  - It shows explored cells, landmarks (the new `-dark` mark images), the player arrow and the objective.
  - **Esc or M closes it.** It uses the shared cursor-release hook from 11h.
  - By day it pauses the game like the journal. At night it doesn't (F8 rule: the screen dims and the sound goes on), if F8 is in. Otherwise it pauses.
- **Mouse:**
  - Wheel zooms, from the whole grounds down to about 30 m across. Drag pans.
  - **Left-click** places a pin. Clicking a landmark pins the landmark and names the pin after it.
  - **Clicking a pin or right-clicking it** removes it.
  - Pins can go on unexplored ground too (shown with a "?"), anywhere inside `PLAYABLE_BOUNDS`.
- **Keyboard:** arrows move a cursor, Enter places, Delete removes, 1–3 select a pin, +/− zoom.

**Pins**
- **Up to 3 pins,** numbered 1–3 in distinct shapes, not only colours.
  - Placing a 4th replaces the oldest.
  - A small legend lists them with their distance, and has "Clear all".
- **Everywhere else:**
  - **Compass:** one marker per pin, e.g. "① 23 m", in the compass style. Pins pointing off the compass's range sit at its edge with an arrow, like the objective marker.
  - **Minimap:** drawn on it, and pinned to its border when off-map (reuse `minimapView` edge pinning).
  - **Journal Map tab:** shown and editable there too.
- **In the world:** a faint upright pencil-line beacon at each pin, so it can be seen through fog.
  - Emissive mesh only, no light, no flashing.
  - Fades out within 4 m.
  - Controlled by a setting, "Show pins in the world", on by default.
- **Reaching a pin:** walking within 2 m clears it, with a soft sound and the caption "[pin reached]".
- **Saving:** pins are saved and restored on Continue and Retry, and cleared on New Game.

**Key change:** M opens the big map now. The minimap toggle moves to **N** (rebindable) and the "Show minimap" setting stays. Update `src/data/controls.ts`, the controls screen, the design bible §10 and §11, and the tutorial or hint text that mentions M.

**Rules and tests**
- Pin rules go in a pure `src/game/systems/mapPins.ts`: add, remove, the limit, reach-to-clear and save/restore.
- The click-to-world maths uses the exact inverse of the map's draw transform. Property test: world → map → world returns the same point at every zoom and pan.
- Browser test:
  1. press M and click a spot;
  2. the compass shows the pin with a distance that drops as you walk to it;
  3. the minimap shows it;
  4. it clears on arrival.

  Also check that M and N work with keyboard only, that the overlay doesn't overlap the HUD at 1920x1080, 1280x720 and 800x600, and take screenshots.

Log both tasks, and list anything you decided without the user under "Decisions made unattended".
