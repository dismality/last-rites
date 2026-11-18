# Last Rites

*A first-person survival-horror mystery in a cursed Victorian cemetery. Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Costume Contest).*

**▶ Play:** https://last-rites.vercel.app (desktop browser, keyboard and mouse)

**New here?** [Instruction manual](docs/manual.md) (no spoilers).

**Stuck?** [Full walkthrough](docs/walkthrough.md) (Part A is spoiler-free; the rest gives every answer).
<!-- TODO before submitting: add the demo video link, e.g. **🎬 Demo video:** https://youtube.com/watch?v=… -->

<!-- Add a screenshot or GIF here: ![Last Rites](docs/screenshot.png) -->

## The story
You are the new gravekeeper of Hollowmere Cemetery, October 1891. The last keeper, Elias Thorne, vanished, and the dead won't stay buried. By day, in a graveyard with nothing living in it, you search the grounds for materials and clues and solve small puzzles. By night the curse holds back the sun, and you survive the dead until you can name the truth at the altar. Solve three cases from Hollowmere's past, finish the rite, and walk out at sunrise, or the cemetery takes you.

## Features
- **The interface is part of the world:** the lantern flame is your oil gauge, the map is the keeper's pencil sketch that inks itself in as you explore, the journal and case board are ink on parchment, and the objective is marked by a pillar of lantern light
- **Three cases, three curse stages:** clue hunting, a case board where you link evidence, and puzzles such as cross-checking the parish ledger against the stones
- **First-person survival:** a lantern that runs on oil, melee and black-powder guns, blocking, dodging and kicking, boarding up the chapel doors
- **Crafting** at the hut's workbench, where what you can make glows
- **The dead:** shamblers, lurkers in dark alleys, wailers, bloaters, brutes and Father Crane
- **Fair horror:** a scare director with telegraphed jumpscares, recorded sound effects and narration
- **Modes:** Easy, Normal, Hard, Short Vigil and Endless
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
| Skip intro | Space or Enter |
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

## How Kiro was used
See [`.kiro/`](.kiro) for the specs, steering docs and hooks, and [`docs/kiro-log.md`](docs/kiro-log.md) for the development log.

## Credits
All third-party assets are listed in [`docs/CREDITS.md`](docs/CREDITS.md).

## License
[MIT](LICENSE)
