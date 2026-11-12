# Kiro prompt: scheduled run (everything still to do)

Paste everything below the line into Kiro as one scheduled task. It is written to run unattended: Kiro works straight through, commits each finished task locally, never pushes, and records every decision in `docs/kiro-log.md` for review afterwards.

---

Work through everything below in order, unattended. I will review afterwards, so do not stop to ask. Where you would have asked, choose the option that keeps the game playable and closest to `docs/case-design.md`, and record the choice and the reason under "Decisions made unattended" in that task's kiro-log entry.

## Rules for the whole run

- **Commit after each finished task, locally. Never push, never force, never rewrite history.**
  - Before each commit: lint, `npm run build` and the full unit test suite must pass, plus the e2e specs the task names.
  - Commit message: `<what changed> (spec NN task X)`.
  - Do not commit scratch files (`e2e/tmp*`, `e2e/logs/*`) or anything under `node_modules`.
- **If a task still fails after two honest attempts:** revert only that task's changes (`git restore`/`git clean` on its files), mark it `[!]` in tasks.md with the reason, log it, and move on. Never leave the tree failing between tasks.
- **Keep:** licenses and CREDITS (add a row for any new asset), accessibility steering, the performance budget, all existing dev-hook calls.
- Hooks and steering apply as always: design bible first when behaviour changes, a kiro-log entry per task.
- **Feature freeze: when the date reaches 2026-11-26,** stop starting new spec 10 feature tasks. Finish the one in progress, then jump to Part 4.
- **Running servers:** keep the dev server on 5173 for e2e. Stop it when the run ends.

## Part 0: Make the browser tests fast (do this first)

- `playwright.config.ts` forces software rendering (`--use-angle=swiftshader`), so every frame takes about 270 ms. This machine has an NVIDIA RTX 5070 Ti, and headless Chrome can use it: `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist` reports the GPU as the WebGL renderer.
  - Make GPU the default.
  - Keep SwiftShader behind an env var (`E2E_SWIFTSHADER=1`) for a worst-case run.
  - Set `workers: 3` (the dev server is shared via `reuseExistingServer`). Drop to 1 for any spec that measures frame times.
  - Rerun `interaction-cues`, `minimap` and `obstruction` to prove it. Log the before and after wall time.
- Replace fixed wall-clock waits in specs with frame-based waits (as 11d did) wherever a spec flakes on the faster frames.
- **Per task:** run only the unit tests and the e2e specs that touch the files you changed. Run the full e2e suite only at the milestones in step 5 and in Part 4.
- Use the dev hook to skip ahead (`setClock`, teleport, give, "skip to stage N", "solve current case") instead of playing through in tests, except the final playthrough test.

## Part 1: Finish spec 09's current work

1. **Spec 09 follow-ups to 11i–11j** (11j itself is done):
   - **Scene re-export:** Claude re-exported `graveyard.glb` and `graveyard-colliders.json`. The oak on Silas's spot (old box #325) and the log beside the Child's Locket are gone; now 353 boxes, the nearest 3.5 m from Silas. Box indices have shifted.
   - **Clear the known case:** remove any "known case" for #325 and rerun `graveyard-walk`.
   - **Collider import:** keep `graveyardColliders.ts` importing the JSON as it is now (user decision). Silence the Vite warning if that's possible without moving the file.
   - **Task 3 (playthrough):** don't keep at it now. It moves into spec 10 as the final task (step 4). Rerun it once after Part 0's GPU switch, since its heading drift may be a slow-frame timing problem, and log the result.
2. **Commit what is done but uncommitted,** as separate commits where the files allow:
   - 11c–11j;
   - the new assets: `public/assets/icons/{boons,runes,marks}`, `public/assets/models/scene`, `tools/blender/graveyard_scene.py`;
   - `docs/CREDITS.md`, `docs/case-design.md`, this prompt.

   If the 11c–11j changes are too interleaved to split, one commit "spec 09 tasks 11c to 11j" is fine.

## Part 2: The redesign (spec 09 task 12, then spec 10)

3. **Spec 09 task 12 (E0):** update `docs/game-design.md` and the steering docs to the 3-stage design. Sources:
   - Part E of `docs/kiro-prompts.md` (E0–E11);
   - F8 in Part F;
   - **`docs/case-design.md`, which overrides Part E where they differ.** Every case is solved through minigames, and stage 3 includes the Silas Vane reveal.

   The user has approved this direction, so do not stop for approval: mark task 12 done with a note "approved 2026-11-11, applied unattended", and log the diff summary.
4. **Create spec `.kiro/specs/10-curse-stages/`** with requirements.md (EARS), design.md and tasks.md, from the updated bible and `docs/case-design.md`.
   - **Task order:** case-design §6 build order.
   - **Cuttable tasks:** mark them as cuttable in that section's cut order.
   - **Each case task's acceptance criteria** cover a right answer, a wrong answer, keyboard-only play, and a browser test that solves it with a real mouse and keyboard.
   - **The playthrough test:** move spec 09 task 3 (automated playthrough) into spec 10 as the final task: a full 3-stage run in Short Vigil.
5. **Build spec 10 task by task, in order.** For each case, take screenshots of every minigame at 1280x720 and 800x600 into `e2e/screenshots/`. After stage 1 and after stage 3 are done, run the full e2e suite once and fix what broke before going on.

## Part 3: Spec 09 polish still open (after spec 10's core: E1, the board, stages 1 and 3, E5)

6. **Do these spec 09 tasks,** updating each to 3 stages where it mentions nights: 17 (movement hint), 18 (responsive HUD and 800x600 test), 19 (Begin visible), 21 (shorter intro), 22 (quit confirmation, Continue on title, F5), and the plain-font half of 20.
   - The intro and the first 5 minutes matter most: a judge must reach the first minigame within 3 minutes of pressing Begin, without reading a manual.
   - Measure that in a browser test and log the time.
7. **Move to "after freeze"** and do last, only if time allows: 15 (dev-log dates), 23 (dead code), and the font-size half of 20.

## Part 4: Ship-ready (always do this, even if spec 10 is cut short)

8. **Deploy check:**
   - `npm run build`, then `npx vite preview`. Load it in the headless browser with the cache off.
   - Report the total download size, the time to the title screen, and that Draco (`/draco/`) and every GLB, PNG and audio file load with no 404 under the production base path.
   - If the first load is over 25 MB, list the largest files and compress what can be compressed without visible loss.
   - Add a simple loading screen with progress if there is none.
   - Do not create a Vercel project or change any account; the user does that.
9. **Performance on a weak machine:** with the new graveyard scene, report `longestFrameMs()` and the average frame time on a 20 s walk at 1280x720. If the average is worse than before the scene swap, first turn off castShadow on the `outer-*`, `grass*` and `leaves*` meshes, then lower the shadow map size, and report the before and after numbers.
10. **Spec 09 task 24 (D1–D9),** updated to 3 stages: one final browser pass. Fix real bugs; log anything left.
11. **Spec 09 tasks 14 (README links and screenshot) and 16 (submission kit):**
    - README: what the game is, how to play, controls, the live link placeholder `https://<your-vercel-link>`, and screenshots from step 5.
    - `docs/submission-kit.md`: the write-up draft (how Kiro was used: specs, steering, hooks, MCP, with real examples from kiro-log), a 3-minute video shot list (first 10 s atmosphere, then the case board and a minigame, the night siege, then 30 s on how Kiro built it), and the disclosure line exactly as: "Claude Code helped with playtesting and created the hero item models and item icons; the game was built with Kiro."

## At the end

Write a final kiro-log entry "Scheduled run summary" with:
- every task done, cut, failed (`[!]`) or not reached;
- every "decision made unattended";
- the deploy numbers and the performance numbers;
- what the user must do by hand: push, the Vercel project, Deployment Protection set to Standard so the production link is public, recording the video, and posting the Social Blitz.

Then stop the dev server.
