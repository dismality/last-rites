# Last Rites

*A first-person survival-horror mystery in a cursed Victorian cemetery. Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Costume Contest).*

**▶ Play:** https://last-rites.vercel.app (desktop browser, keyboard and mouse)

**💻 PC and laptop only.** Last Rites needs a keyboard and a mouse (or trackpad) and a desktop browser such as Chrome, Edge or Firefox. It does not work on phones or tablets.

**New here?** [Instruction manual](docs/manual.md) (no spoilers).

**Stuck?** [Full walkthrough](docs/walkthrough.md) (Part A is spoiler-free; the rest gives every answer).

**Judging with only a few minutes?** On the New Game screen pick **Developer mode**. It is the same game, but **]** skips the current step and **`** opens a panel that jumps to stage 2 or 3, so you can see the catacombs and the final rite without playing the whole run.
<!-- TODO before submitting: add the demo video link, e.g. **🎬 Demo video:** https://youtube.com/watch?v=… -->

<!-- Add a screenshot or GIF here: ![Last Rites](docs/screenshot.png) -->

## The story
You are the new gravekeeper of Hollowmere Cemetery, October 1891. The last keeper, Elias Thorne, vanished, and the dead won't stay buried. By day, in a graveyard with nothing living in it, you search the grounds for materials and clues and solve small puzzles. By night the curse holds back the sun, and you survive the dead until you can name the truth at the altar. Solve three cases from Hollowmere's past, finish the rite, and walk out at sunrise, or the cemetery takes you.

## Features
- **The interface is part of the world:** the lantern flame is your oil gauge, the map is the keeper's pencil sketch that inks itself in as you explore, the journal and its case notes are ink on parchment, and the objective is marked by a pillar of lantern light
- **Three cases, three curse stages:** buried alive, body snatchers and a sealed crypt, one family's story. Each is a chain of small puzzles: cross-check the parish ledger against the stones, pull the safety-bell cords, read a torn watch log, match boot prints, decode a hymn board, compare handwriting
- **A keeper who guides you, with a little mischief:** the objective is a pillar of lantern light with an italic line saying why it matters; after two quiet minutes your lantern flame leans toward the nearest clue you missed; and the game talks back in the keeper's dry voice (a wrong answer at the altar: *"A sour note, and the dead take it personally"*)
- **First-person survival:** a lantern that runs on oil, melee and black-powder guns, blocking, dodging and kicking, boarding up the chapel doors
- **Crafting** at the hut's workbench, where what you can make glows
- **The dead:** shamblers, lurkers in dark alleys, wailers, bloaters, brutes and corpse hounds
- **Fair horror:** a scare director with telegraphed jumpscares, recorded sound effects and narration
- **Two ways in:** Normal, or Developer mode (the same game with a skip key and a stage-jump panel)
- **Comfort settings:** scare intensity (Full/Reduced/Off), no-flash mode, FOV, head bob, subtitles for every important sound, plain journal font, rebindable keys

## Controls
| Action | Key |
|---|---|
| Move / look | WASD / mouse |
| Sprint | Shift |
| Interact, dig (hold) | E |
| Attack / block (aim with a gun) | Left / right mouse |
| Heavy attack, kick, dodge | V, Q, C |
| Reload | R |
| Hotbar | 1–4 |
| Satchel / journal | Tab / J |
| Lantern | F |
| Map / minimap | M / N |
| Skip intro / skip the keeper's line | Space |
| Pause | Esc |

All keys can be rebound in Settings.

## Run locally
Requires Node.js 20 or later.
```bash
npm install
npm run dev
```
Open the URL shown in the terminal (usually http://localhost:5173).

Recorded audio lives in `public/assets/audio/`; see `tools/audio/` for the scripts that make and convert it.

Other commands: `npm run build`, `npm run test`, `npm run lint`.

## Built with Kiro
Last Rites was built spec-first in [Kiro](https://kiro.dev). Everything is in [`.kiro/`](.kiro) at the root of this repo, and [`docs/kiro-log.md`](docs/kiro-log.md) logs every change.

| Kiro feature | What it did here |
|---|---|
| **Specs** ([`.kiro/specs/`](.kiro/specs)) | 11 specs, from `01-foundation` to `11-horror-pass`: about 1,150 EARS `SHALL` requirements and 481 tasks, 468 done. Playtest findings became new specs (`09-playtest-fixes`, `10-curse-stages`) instead of drifting edits. |
| **Steering** ([`.kiro/steering/`](.kiro/steering)) | 8 docs: product, tech, structure, horror design, visual style, accessibility, MCP usage and the log rule. `horror-design.md` is why every scare Kiro wrote comes with a warning first and respects Reduced and Off. |
| **Hooks** ([`.kiro/hooks/`](.kiro/hooks)) | 6 hooks: test game logic on save, data matches the design bible, scare accessibility audit, asset licence check, performance review, update the Kiro log. |
| **Property-based tests** | fast-check in 181 of 362 unit test files, generated from the specs' correctness properties. They caught real bugs (a `NaN` timestep, float rounding in `lerp`, an ammo stack overflow). |
| **MCP** | context7 for current library APIs (Rapier, React Three Fiber, drei). |

## Learn from it
The repo is MIT-licensed and meant to be read, not just played:
- **A spec-driven game, end to end.** Each spec's `requirements.md`, `design.md` and `tasks.md` show how a feature went from EARS requirements to pure, tested functions.
- **Property tests for game logic.** `src/game/systems/*.test.ts` has examples for wave curves, objectives, altar rules and the map's zoom and pan.
- **Accessible horror.** Scare intensity Full/Reduced/Off, captions for every important sound, no-flash mode and rebindable keys, all checked by a hook (`.kiro/hooks/scare-accessibility-audit.json`).
- **A Blender-to-browser pipeline.** `tools/blender/` builds the props as GLB files from Python.

## Built with
Kiro · React Three Fiber · three.js · Rapier physics · zustand · Howler.js · fast-check · Vitest · Playwright · Vite · TypeScript · Blender · ElevenLabs (sound and narration)

## Credits
All third-party assets are listed in [`docs/CREDITS.md`](docs/CREDITS.md).

## License
[MIT](LICENSE)
