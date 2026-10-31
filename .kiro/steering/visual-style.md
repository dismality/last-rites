---
inclusion: fileMatch
fileMatchPattern: "src/{ui,scene}/**"
---
# Visual Style Guide

## Mood
Victorian gothic cemetery in perpetual autumn: wet stone, iron fences, dead oaks, low fog. Moonlight is cold blue-grey, lantern light is warm amber. That warm-versus-cold contrast is the visual signature of the game.

## Palette (CSS tokens in `src/ui/theme/tokens.css`)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#14110f` | backgrounds, deep shadow |
| `--parchment` | `#d8c9a3` | UI paper surfaces |
| `--parchment-dark` | `#a8946a` | paper edges, dividers |
| `--ember` | `#e8913a` | lantern, active, craftable glow |
| `--blood` | `#7a1f1f` | damage, danger, low health |
| `--moon` | `#9fb3c8` | night tint, cold accents |
| `--holy` | `#cfe6d8` | holy-water effects, consecrated items |

## Typography
- Headings: **IM Fell English SC** (Google Fonts)
- Body and handwritten journal: **IM Fell English** for print, **Homemade Apple** for the keeper's handwriting
- UI numbers: **Cormorant Garamond** (tabular figures)
- Minimum UI text size 16 px; subtitles 20 px with a dark backing.

## UI is diegetic (in-world) where possible
- **Health** = the lantern flame icon in the bottom-left. Bright and tall when healthy, guttering and red-tinged when low. A numeric value is shown in the accessible HUD mode.
- **Lantern fuel** = the glass reservoir level under the flame.
- **Satchel** = a leather bag opening with a creak; items lie on cloth as small 3D renders or illustrated icons.
- **Journal** = aged paper pages with ink, stains and torn edges. Clues are underlined by hand as they are discovered.
- **Map** = the keeper's pencil sketch that inks itself in as zones are explored.
- **Crosshair** = a tiny dot that turns into a hand icon over interactables.

## Motion
- UI transitions 150–300 ms, ease-out. Paper slides; nothing bounces.
- Respect `prefers-reduced-motion` and the in-game "reduce motion" setting: no camera shake, no head bob, fades instead of slides.

## 3D look
- Low-poly CC0 models, made consistent through shared materials, fog and post-processing rather than texture detail.
- Post-processing chain: fog → bloom (lantern and holy only) → vignette → subtle film grain.
- Every interactable item has a faint pulse visible within lantern range, plus a stronger outline on hover.
