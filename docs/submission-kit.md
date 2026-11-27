# Submission Kit

Drafts for the Devpost form (Kiroween 2026, **Costume Contest**). Deadline: **Friday 4 December 2026, 2:00 PM Pacific**.
Numbers below were counted from the repo on 28 November 2026; recount before submitting.

## Checklist (from the Devpost rules)

- [x] Public GitHub repo: https://github.com/dismality/last-rites
- [x] Open-source license detected in the About section (MIT)
- [x] `/.kiro` at the root with specs, hooks and steering, not in `.gitignore`
- [x] Built inside the Submission Period (first commit 1 November 2026)
- [x] Working app URL: https://last-rites.vercel.app
- [x] README with how to run it locally, a "Built with Kiro" table and a quick path for judges (Developer mode)
- [ ] Demo video under 3 minutes, public on YouTube, no copyrighted music; link it in the README. **Show a spec, a hook and a steering doc on screen** (see the script below)
- [ ] Text description (below): paste it, and add **Kiro** to "Built With"
- [ ] "How Kiro was used" write-up (below): fill in the two `[you]` gaps
- [ ] Check the Official Rules on other AI tools and AI-generated assets (ElevenLabs audio, any generated models), that the ElevenLabs plan used allows this use, and settle the disclosure paragraph (below)
- [ ] Optional bonus prizes: Social Blitz post starting with `#KiroweenHackathon26`; Bonus Blog post that says it is part of Kiroween 2026

### What the judges said they look for

- *Scare me, then make it easy; a little mischief; smile and still know what to tap next.* The keeper's guidance (the lantern pillar and its "why" line, the flame that leans toward a missed clue) and the dry lines when you get it wrong. Show both in the video.
- *Things that outlive the hackathon: open source, resources for learners.* The README's "Learn from it" section: a spec-driven game end to end, property tests for game logic, accessible horror settings, a Blender-to-browser pipeline. All MIT.
- *Make Kiro impossible to miss.* Name the Kiro features in the description, add Kiro to Built With, show a spec, a hook and steering in the video, and keep `/.kiro` at the root.

---

## Devpost: project description (draft)

**Last Rites** is a first-person survival-horror mystery that runs in your browser, built spec-first with **Kiro**.

Hollowmere, October 1891. You are the new gravekeeper. Your predecessor, Elias Thorne, vanished, and the graves are opening from the inside. By day, in a graveyard with nothing living in it, you follow Elias's notes: read the stones, cross-check the parish ledger, pull the cords of the safety bells that were meant to save anyone buried alive. One cord has been cut. By night the curse holds back the sun, and the dead come in waves until you name the truth at the chapel altar. Three cases, one family's secret, and a rite that has to be laid in the right order before sunrise.

**Why it fits Costume Contest:** the spooky interface is how you play.
- The **lantern flame is your oil gauge**, and your light shrinks with it.
- The **map is the keeper's pencil sketch**, inking itself in as you explore; pins you draw on it stand in the world as pencil lines.
- The **journal** is ink on parchment, and writes up each case in the keeper's hand.
- The **objective is a pillar of lantern light** with its name, its distance and one line on why it matters. If you wander for two minutes without finding anything, your **lantern flame leans toward the clue you missed**.
- **It talks back, with a little mischief.** A wrong answer at the altar: *"A sour note, and the dead take it personally."* Leave a blank: *"The altar does not do blanks."* Even the crash screen is in the keeper's voice, with one clear button to press.
- Every scare is **telegraphed** first (a sound, a light, a silence), and recorded narration and sound carry the dread.

**Horror for everyone:** scare intensity Full/Reduced/Off, no-flash mode, FOV, head bob, captions for every important sound, a plain journal font, rebindable keys. **Short on time?** Developer mode skips steps and jumps to any stage.

**Open source, to learn from:** MIT-licensed, with the full Kiro specs, steering and hooks in `/.kiro`, 2,900 unit tests (half of the test files property-based), and a Python Blender pipeline for the models.

**Built with:** Kiro (specs, steering, hooks, MCP), React Three Fiber, three.js, Rapier physics, zustand, Howler.js, fast-check, Vitest, Playwright, Vite, TypeScript, Blender, ElevenLabs (sound and narration).

---

## "How Kiro was used" write-up (draft)

Kiro ran this project from the first plan onwards. Everything below is in the repo: `.kiro/` and the development log, `docs/kiro-log.md`.

**1. Spec-driven development.** 11 specs (foundation, exploration, crafting, combat, mystery and scares, HUD clarity, enemies, progression, playtest fixes, curse stages, horror pass), with about 1,150 EARS `SHALL` requirements and 481 tasks, 468 of them done. Each spec's design names the files and pure functions it adds, so Kiro's tasks stayed small and testable. A design bible (`docs/game-design.md`) is the single source of truth, pulled into every session through steering. Compared with vibe coding, the specs stopped scope creep: when playtests found problems, they became a new spec (09 playtest fixes, 10 curse stages) instead of drifting edits.

**2. Steering.** 8 steering docs: product, tech, structure, horror design, visual style, accessibility, MCP usage and the log rule. The biggest win was `horror-design.md`: every scare Kiro generated came with a telegraph and intensity scaling without being asked. `product.md` pulls in the design bible with `#[[file:docs/game-design.md]]`, and `tech.md` pinned the version stack after Kiro's first review caught a React 18 / R3F 8 mismatch.

**3. Hooks.** 6 hooks:
- *Test game logic on save* runs the unit tests when `src/game` or `src/data` changes.
- *Data matches design bible* checks data files against the bible on save.
- *Scare accessibility audit* checks that every scare respects Reduced and Off.
- *Asset license check* makes sure every new file under `public/assets` has a CREDITS row.
- *Performance review* and *Update Kiro usage log* run on request.

**4. Property-based testing.** fast-check is used in 181 of 362 unit test files (about 2,900 tests), plus 55 browser test files. Real catches:
- `fc.float` can produce `NaN` even with bounds, which would have broken the fixed timestep; generators switched to integer milliseconds.
- A property exposed float rounding in `lerp` at k = 1 (fixed with the `a*(1-k)+b*k` form).
- An overflow property showed ammo opening a second over-full stack; the held total is now capped.
- A world → screen → world round trip guards the big map's zoom and pan.
- A guidance property now checks that no day step of any stage ever leaves the player without a marker.

**5. MCP.** context7 for current library APIs. Examples: the Rapier v2 body type is `kinematicPosition`, not `kinematic-position-based`; the R3F 9 `useFrame` and drei 10 `Instances` APIs; drei `useProgress` for the loading screen.

**6. Catching bugs before players did.** A headless Rapier check showed fixed sensors never report a kinematic player by default, so the scare zones would never fire; they now set `ActiveCollisionTypes.ALL`, with a test that guards it. A headless-Chrome playtest found zombies boxed in by those same sensors, a bug the unit tests missed.

**7. Honest log.** Every change is logged in `docs/kiro-log.md`. Some late tasks were done outside Kiro against the same Kiro specs and task lists; each one is marked **Outside Kiro** in the log.
> **Disclosure draft, for you to settle against the Official Rules:** "Most of the code was written by Kiro from the specs. Some late playtest fixes were made outside Kiro, with `[you: name the tool, or 'by hand']`, against the same specs and task lists; each is marked Outside Kiro in the log. Sound effects and narration were generated with ElevenLabs; 3D props were built in Blender from Python scripts in `tools/blender/`."

**8. Kiro apps, custom agents, powers.** `[you: which Kiro apps you used (IDE, CLI, Web), and any custom agent or power you tried, with what it changed.]`

**9. What I'd do differently.** *(Draft; edit to your own words.)*
- **Playtest with a fresh player in week one, not week three.** The specs kept the code honest, but only playtests showed where players got lost: the case board's red-string linking was cut in favour of journal write-ups after players found it confusing, and the relic and key markers were reworked twice.
- **Spec the first ten minutes before anything else.** Kiro built three full cases from the specs faster than I could play-test them. A spec for "a new player's first ten minutes", with acceptance criteria like "never more than one step without a marker", would have caught the guidance gaps earlier.
- **Keep the end-to-end playthrough green every day.** A whole-run browser test exists, but it fell behind the game for a week; keeping it green would have flagged the changed puzzles at once.

---

## Demo video script (2:50)

**The hook:** open on the mystery, not the menu. Stage 1 is built on a real Victorian fear, being buried alive, and the safety bell with its cut cord is a ten-second cold open. Developer mode gets you to every shot fast (`]` skips a step, `` ` `` jumps stages).

| Time | Shot | Sound / voice | On-screen text |
|---|---|---|---|
| **0:00–0:08** | Black. Then a slow push in on Pell's safety bell at night, in fog. The bell twitches once. | Silence, then **one faint bell ring from below the ground**. | — |
| **0:08–0:14** | Close-up: the cord, cut clean. | On-screen text only, or a new narrator line: *"In 1862, they buried John Pell with a bell, in case he woke."* (beat) *"Someone cut the cord."* | — |
| **0:14–0:18** | Hard cut to black. Title. | A deep bell toll. | **LAST RITES** |
| **0:18–0:32** | The intro cutscene: Hollowmere, the fence, the hut. | The game's own intro narration. | *Hollowmere, 1891* |
| **0:32–0:38** | Elias's note on the hut table. | Narrator: *"Whatever he knew, he wrote it down."* | — |
| **0:38–1:00** | **The interface is the costume.** Quick cuts, about 3 s each: the lantern flame burning down as the light shrinks; the pencil map inking itself in; a pin standing in the world as a pencil line; the workbench glowing. | Ambience only. | One caption per cut: *Your lantern is your fuel gauge.* / *Your map is his sketch.* |
| **1:00–1:20** | **The mystery, with a guide.** The objective pillar and its "why" line; the ledger cross-check, a mismatch flagged; pulling Pell's cord and finding it cut; the lantern flame leaning toward a missed clue. | The pencil scratch, the dead cord. | *A keeper who points the way.* |
| **1:20–1:28** | **A little mischief.** A wrong name at the altar: the line *"A sour note, and the dead take it personally"*, and the dead rise. | One sour note. | — |
| **1:28–1:36** | Dusk falls fast (time-lapse). The sky bleeds out. | The music drops out. A long silence. | *By night, the curse holds back the sun.* |
| **1:36–1:58** | **Night.** Boarding the chapel door. A telegraph (a sound, a flicker), then the scare lands. A wave at the chapel, a shotgun blast, the brute's grunt. Fast cuts. | Leave one scare with no voice-over and no music. | — |
| **1:58–2:08** | The right name at the altar. The dead fall to dust. The sun rises over the graves. | The bell, then quiet birdsong. | *Name the truth before dawn.* |
| **2:08–2:18** | **The tease.** The hymn board, the tiles spelling **B-E-L-O-W**, the hidden stair opening, a slow walk down into the catacombs. Cut before what's below. | Stone grinding, footsteps. | *Three cases. One family. One keeper who never came back.* |
| **2:18–2:26** | Settings: scare intensity to Off; the same scare as a caption only. | — | *Horror for everyone.* |
| **2:26–2:44** | **Kiro, impossible to miss.** Kiro open on `.kiro/specs/10-curse-stages/requirements.md` (EARS `SHALL` lines scrolling); a hook firing on save ("Test game logic on save") with tests passing; `.kiro/steering/horror-design.md` open on the telegraph rule; a property test going red, then green. | On-screen text or narrator: *"Built spec-first with Kiro: 11 specs, 8 steering docs, 6 hooks, and every scare warned of first."* | Kiro logo, `/.kiro` folder tree |
| **2:44–2:50** | Back to Pell's bell in the fog. **It rings.** Cut to black. | One bell. | **last-rites.vercel.app** · GitHub URL · *Open source (MIT)* |

**Why this works:** it opens and closes on the same bell, so the question ("who's ringing it?") is still open when the video ends. The first 15 seconds sell the mystery before any interface; the next minute answers "why Costume Contest"; the mischief and Kiro beats answer the judges' own questions.

**Recording tips:** OBS Studio at 1080p60 in Chrome, Developer mode on. Subtitles off except in the comfort-settings shot. The game's own audio is generated for this project (see `docs/CREDITS.md`); add no copyrighted music. Upload as Public on YouTube and put the link in the README.
