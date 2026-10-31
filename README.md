# Last Rites

*A first-person survival-horror mystery in a cursed Victorian cemetery. Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Costume Contest).*

**▶ Play:** https://YOUR-DEPLOY-URL.vercel.app
**🎬 Demo video:** https://youtube.com/YOUR-VIDEO

<!-- Add a screenshot or GIF here: ![Last Rites](docs/screenshot.png) -->

## The story
You are the new gravekeeper of Hollowmere Cemetery. The last keeper vanished, and the dead won't stay buried. By day, search the graves for materials and clues. By night, survive what you dug up. Find the five relics and finish the rite before the fifth night ends.

## Features
- First-person 3D exploration with a lantern that runs on fuel; light is a resource
- 3D workbench crafting where the items you can combine glow
- Three zombie types, including the Lurker that waits in dark alleys
- A scare director that runs fair, telegraphed jumpscares
- A mystery told through journal pages, tombstones and objects you examine in 3D
- Five nights, chapel repairs, three endings
- Full comfort settings: scare intensity (Full/Reduced/Off), no-flash mode, FOV, subtitles, rebindable keys

## Controls
| Action | Key |
|---|---|
| Move / look | WASD / mouse |
| Sprint | Shift |
| Interact, dig | E |
| Attack / aim | Left / right mouse |
| Hotbar | 1–4 |
| Satchel / journal | Tab / J |
| Lantern | F |
| Pause | Esc |

## Run locally
Requires Node.js 20 or later.
```bash
npm install
npm run dev
```
Open the URL shown in the terminal (usually http://localhost:5173).

Other commands: `npm run build`, `npm run test`, `npm run lint`.

## How Kiro was used
See [`.kiro/`](.kiro) for the specs, steering docs and hooks, and [`docs/kiro-log.md`](docs/kiro-log.md) for the development log.

## Credits
All third-party assets are listed in [`docs/CREDITS.md`](docs/CREDITS.md).

## License
[MIT](LICENSE)
