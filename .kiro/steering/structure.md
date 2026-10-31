---
inclusion: always
---
# Project Structure

```
/
├── .kiro/                  # Kiro specs, steering, hooks (never gitignore)
├── docs/
│   ├── game-design.md      # design bible: content source of truth
│   ├── kiro-log.md         # running log of how Kiro was used (for the write-up)
│   └── CREDITS.md          # every third-party asset with source and license
├── public/
│   └── assets/
│       ├── models/         # .glb only, compressed
│       ├── textures/
│       └── audio/          # .ogg + .mp3 fallback
├── src/
│   ├── main.tsx
│   ├── App.tsx             # routes between Title, Game, Ending screens
│   ├── data/               # typed content: items.ts, recipes.ts, enemies.ts, scares.ts, journal.ts, zones.ts
│   ├── game/
│   │   ├── state/          # zustand stores
│   │   ├── systems/        # pure logic: inventory, crafting, combat, waves, scares, dayNight, mystery, lantern
│   │   └── types.ts        # shared domain types
│   ├── scene/
│   │   ├── GameLoop.tsx    # fixed-timestep driver
│   │   ├── player/         # FirstPersonController, Viewmodel (hands + weapon), Lantern
│   │   ├── world/          # Cemetery, zones, props, Chapel, Workbench
│   │   ├── enemies/        # zombie components + animation
│   │   ├── scares/         # scare trigger volumes and staged events
│   │   └── effects/        # post-processing, fog, particles
│   ├── ui/
│   │   ├── hud/            # LanternHealth, Crosshair, InteractPrompt, Subtitles
│   │   ├── menus/          # Title, Pause, Settings, Ending
│   │   ├── satchel/        # inventory overlay
│   │   ├── journal/        # lore pages, clues, map
│   │   └── theme/          # fonts, CSS tokens, shared ornaments
│   └── audio/              # AudioManager wrapping Howler
└── tests/                  # cross-system integration tests
```

## Conventions
- Tests sit next to their file: `CraftingSystem.ts` → `CraftingSystem.test.ts`.
- IDs are kebab-case string literals typed as unions (`'bone-club' | 'sharpened-shovel'`).
- Never place assets in `src/`; load them from `public/assets/` using paths in `src/data/assets.ts`.
- Each new third-party asset gets a line in `docs/CREDITS.md` in the same change.
