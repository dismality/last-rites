# Kiro prompt: recipe source hints and bench models

Paste everything below the line into Kiro.

---

A small follow-up from the user's playtest. Add it to `.kiro/specs/09-playtest-fixes/tasks.md` as **11m** (after 11l). Do it next: finish the spec 10 step you're on and commit it, then do 11m, then carry on with spec 10. Same rules: design bible first, a kiro-log entry, lint, build and unit tests pass, commit locally, never push.

## 11m. Unknown recipes say where to look; bench stock uses the models

**1. Where to find what's missing.** An undiscovered recipe can stay "???" with a silhouette, but it must tell the player where its missing ingredients come from. Today the tooltip only says "Pick up one of each ingredient to learn this recipe", and the missing ingredient shows as "???" with no hint.

- **Pure helper:** add `itemSources(itemId)` in `src/game/systems/`. It works only from the data: `lootTables.ts` (grave mounds, coffins, dug-grave loot, elites, the merchant), `zones.ts` FIXED_SPAWNS and SPAWN_POINTS, the hut shelf, and the merchant's stock. It returns a short list of places in plain words, e.g. "dug from grave mounds", "in coffins on the grounds", "on the hut shelf", "sold by Silas at dawn".
  - Unit-test that every material used by any recipe has at least one source. If one has none, that is a bug: report it.
- **Each missing ingredient** shows its source under the "???", for example "??? · dug from grave mounds, found in coffins". The ingredient itself stays unnamed until it's held.
- **The tooltip of an unknown recipe** reads like:
  > ???
  > Needs 2 ingredients. You have: Cloth.
  > Still to find: something dug from grave mounds or found in coffins.
- **A "Mark on map" button** on the row (keyboard: M on a focused row) drops a map pin (11l) on the nearest source of the first missing ingredient. Skip places already looted or dug today. If there's no reachable source today, show "None left today. Try again tomorrow" instead of a pin.
- **Known recipes** with a missing ingredient (like Bandage, "Cloth 1/2, need 1 more") show the same "Found: …" line under the count.
- **Keep it short:** at most two places per ingredient, nearest first. The text sits in the recipe card and the tooltip, readable at 800x600 with the plain-font setting.

**2. Bench stock uses the models.** The material piles on the workbench top (`Workbench.tsx`, the `Instances` of `boxGeometry` around line 310) are still coloured boxes; the cream and yellow blocks in the user's screenshot are these. Draw each pile with the item's Blender model, as the recipe ghost already does with `GroundItem` and `benchScale`, keeping the ember glow on craftable and highlighted piles (emissive on the model's material, no light).

- The missing-ingredient outline in the recipe ghost can stay a wireframe, but make it the item's silhouette (the model in flat dark material) rather than a box, so the shape hints at what's missing.
- Search for any other `boxGeometry` or `cylinderGeometry` standing in for an item and give it the model too. Leave building parts, fences and UI alone. List what you changed.

**Tests:**
- Unit: `itemSources` covers every recipe material; the tooltip text for a known and an unknown recipe; Mark on map picks the nearest unlooted source.
- Browser:
  1. open the bench with an unknown recipe and check the source text shows;
  2. press Mark on map and check a pin appears on the compass;
  3. screenshot the bench showing the model piles at 1280x720 and 800x600.
