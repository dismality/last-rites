# Submission Kit

Drafts for the Devpost form (Kiroween 2026, **Costume Contest**). Deadline: **Friday 4 December 2026, 2:00 PM Pacific**.
Numbers below were counted from the repo on 18 November 2026; recount before submitting.

## Checklist (from the Devpost rules)

- [x] Public GitHub repo: https://github.com/dismality/last-rites
- [x] Open-source license detected in the About section (MIT)
- [x] `/.kiro` at the root with specs, hooks and steering, not in `.gitignore`
- [x] Built inside the Submission Period (first commit 1 November 2026)
- [x] Working app URL: https://last-rites.vercel.app
- [x] README with how to run it locally
- [ ] Demo video under 3 minutes, public on YouTube, no copyrighted music; link it in the README
- [ ] Text description (below)
- [ ] "How Kiro was used" write-up (below)
- [ ] Check the Official Rules on other AI tools and AI-generated assets (ElevenLabs audio), and that the ElevenLabs plan used allows this use
- [ ] Optional bonus prizes: Social Blitz post starting with `#KiroweenHackathon26`; Bonus Blog post that says it is part of Kiroween 2026

---

## Devpost: project description (draft)

**Last Rites** is a first-person survival-horror mystery that runs in your browser.

Hollowmere, October 1891. You are the new gravekeeper. Your predecessor, Elias Thorne, vanished, and the graves are opening from the inside. By day, in a graveyard with nothing living in it, you search for materials and clues, examine evidence in 3D and solve small puzzles, like cross-checking the parish ledger against the stones. By night the curse holds back the sun and you survive the dead with what you crafted. Solve three cases from Hollowmere's past, name the truth at the altar, finish the rite and walk out at sunrise, or the cemetery takes you.

**Why it fits Costume Contest:** the spooky interface is how you play.
- The **lantern flame is your oil gauge**, and your light shrinks with it.
- The **map is the keeper's pencil sketch**, inking itself in as you explore; pins you draw on it stand in the world as pencil lines.
- The **journal** is ink on parchment, and the **case board** is a cork board of pinned clue cards you join with red string; each correct link lowers the curse meter.
- The **objective is a pillar of lantern light** with its name and distance, so you always know where to go without a modern waypoint.
- The **workbench glows** to show what you can craft, and a blood-red health bar shows the chunk each hit took.
- Every scare is **telegraphed** first (a sound, a light, a silence), and narration and recorded sound carry the dread.

**Comfort settings:** scare intensity Full/Reduced/Off, no-flash mode, FOV, head bob, subtitles for every important sound, a plain journal font, rebindable keys.

**Built with:** Kiro, React Three Fiber, Rapier physics, zustand, Howler.js, fast-check, Vite, TypeScript, Blender (models), ElevenLabs (sound and narration).

---

## "How Kiro was used" write-up (draft)

Kiro ran this project from the first plan to the last fix. Everything below is in the repo: `.kiro/` and the development log, `docs/kiro-log.md`.

**1. Spec-driven development.** 11 specs (foundation, exploration, crafting, combat, mystery and scares, HUD clarity, enemies, progression, playtest fixes, curse stages, horror pass), with about 1,450 EARS `SHALL` requirements and 478 tasks, 420 of them done. Each spec's design names the files and pure functions it adds, so Kiro's tasks stayed small and testable. A design bible (`docs/game-design.md`) is the single source of truth, pulled into every session through steering. Compared with vibe coding, the specs stopped scope creep: when playtests found problems, they became a new spec (09 playtest fixes) instead of drifting edits.

**2. Steering.** 8 steering docs: product, tech, structure, horror design, visual style, accessibility, MCP usage and the log rule. The biggest win was `horror-design.md`: every scare Kiro generated came with a telegraph and intensity scaling without being asked. `product.md` pulls in the design bible with `#[[file:docs/game-design.md]]`, and `tech.md` pinned the version stack after Kiro's first review caught a React 18 / R3F 8 mismatch.

**3. Hooks.** 6 hooks:
- *Test game logic on save* runs the unit tests when `src/game` or `src/data` changes.
- *Data matches design bible* checks data files against the bible on save.
- *Scare accessibility audit* checks that every scare respects Reduced and Off.
- *Asset license check* makes sure every new file under `public/assets` has a CREDITS row.
- *Performance review* and *Update Kiro usage log* run on request.

**4. Property-based testing.** fast-check is used in 157 test files, out of 319 unit test files (2,587 tests) plus 49 browser test files. Real catches:
- `fc.float` can produce `NaN` even with bounds, which would have broken the fixed timestep; generators switched to integer milliseconds.
- A property exposed float rounding in `lerp` at k = 1 (fixed with the `a*(1-k)+b*k` form).
- An overflow property showed ammo opening a second over-full stack; the held total is now capped.
- A world → screen → world round trip guards the big map's zoom and pan.

**5. MCP.** context7 for current library APIs. Examples: the Rapier v2 body type is `kinematicPosition`, not `kinematic-position-based`; the R3F 9 `useFrame` and drei 10 `Instances` APIs; drei `useProgress` for the loading screen.

**6. Catching bugs before players did.** A headless Rapier check showed fixed sensors never report a kinematic player by default, so the scare zones would never fire; they now set `ActiveCollisionTypes.ALL`, with a test that guards it. A headless-Chrome playtest found zombies boxed in by those same sensors, a bug the unit tests missed.

**7. Honest log.** Every change is logged. Some late tasks were done outside Kiro against the same Kiro specs and task lists; each one is marked **Outside Kiro** in the log. _(Check the Official Rules on other tools and adjust this paragraph.)_

**8. Kiro apps, Crew, custom agents, powers.** _[Fill in: which Kiro apps you used (IDE, CLI, Web, Crew), and any custom agent or power you try for the remaining spec 11 tasks, with what it changed.]_

**9. What I'd do differently.** _[Fill in.]_

---

## Demo video script (under 2:50)

| Time | Shot | Voice-over / on-screen text |
|---|---|---|
| 0:00–0:15 | The intro cutscene: fog, the fence, the hut | Use the game's own narration ("Hollowmere, October 1891…") |
| 0:15–0:35 | Day: walk the grounds with the lantern, follow the objective pillar, examine a clue in 3D | "The interface is part of the world." |
| 0:35–0:55 | Ledger cross-check puzzle, then the case board: link two clues, the curse meter drops | Show the cork board and red string |
| 0:55–1:10 | Workbench: what you can make glows; craft a weapon | |
| 1:10–1:40 | Dusk to night: lantern oil gauge, a telegraphed scare, a wave at the chapel | Fast cuts; let one scare land with no voice-over |
| 1:40–2:00 | The big map inking itself in, a pin standing in the world | |
| 2:00–2:15 | Settings: scare intensity Off, the same scare as a subtitle only | "Horror for everyone." |
| 2:15–2:40 | Kiro: a spec's tasks, a hook firing on save, a property test failing then passing | "Built spec-first with Kiro." |
| 2:40–2:50 | Title card, play URL, GitHub URL | |

**Recording tips:** OBS Studio at 1080p60 in Chrome. The game's own audio is generated for this project (see `docs/CREDITS.md`); add no copyrighted music. Upload as Public on YouTube and put the link in the README.
