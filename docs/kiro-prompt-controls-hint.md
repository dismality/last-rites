# Kiro prompt: controls hint at the bottom left

Paste everything below the line into Kiro.

---

A follow-up from the user's playtest. Do it as spec 09 **task 17 (B11, movement hint)**, rewritten as below, next after the step you're on (finish and commit that step first). The usual rules apply: design bible §11 first, a kiro-log entry, lint, build and unit tests pass, commit locally, never push.

## 17. Controls hint at the bottom left

The user wants the bottom-left of the screen to tell the player which keys move, sprint and charge.

**What it shows.** A small panel in the HUD's parchment-on-dark style, just above the health bar and the oil gauge, with no overlap. One line per action, each a key cap plus a word:
- `W A S D` Move
- `Shift` Sprint, with the stamina bar named beside it (see below)
- `Hold V` Charge a heavy swing. **Show this line only while a weapon that can charge is in hand** (the wood axe and silver sabre, from `heavyMelee.ts`). With any other weapon, leave it out rather than show a key that does nothing.

**Keys come from the player's bindings,** read live from `settingsStore` (default W A S D, Left Shift, V), so a rebound key shows correctly. Write key names readably: "Shift", not "ShiftLeft"; "Mouse 2", not "Mouse2".

**When it shows:**
- From the end of the intro.
- Each line fades out (a steady fade with Flashing lights off) once the player has used that action: moved about 10 m, sprinted for 2 s, and charged one heavy swing. When all its lines have faded, the panel is gone.
- The charge line comes back the first time an axe or sabre is equipped, until it has been used once.
- A new setting, "Show control hints" (on by default), can hide or bring back the whole panel. Turning it back on shows every line again.
- Hidden during menus, the workbench view, the big map, examine, cutscenes and endings.
- Remember which lines were used in the save. It does not come back on Continue unless the setting is turned back on.

**Stamina bar:** the plain bar at the bottom centre has no label. Add a small "Stamina" caption, or a run icon with an accessible name, so the Sprint line's meaning is clear.

**Rules and data:** the hint lines (action, word, condition, how to clear) go in `src/data/controlHints.ts`. The show and clear logic is pure, in `src/game/systems/controlHints.ts`. The texts must stay inside the panel at 800x600 with the plain-font setting.

**Compass bug in the same screenshot:** the objective marker's distance ("19 m") is drawn on top of the "Hut" label when both point the same way. Labels that would overlap should stack on a second row or shift aside; never draw one over another. Add a unit test for the layout, and a screenshot with the hut and the objective in the same direction.

**Tests:**
- Unit: rebound keys show; the charge line appears only with the axe or sabre; each line clears after its action; the setting brings them back; save and restore.
- Browser:
  1. start a run and see the panel after the intro;
  2. walk and sprint and see those lines fade;
  3. equip the axe and see the charge line, charge once and see it go;
  4. confirm no overlap with the health bar, oil gauge, hotbar or captions at 1920x1080, 1280x720 and 800x600.
- Take screenshots.
