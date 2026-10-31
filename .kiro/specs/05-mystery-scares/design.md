# Design: Mystery, Scare Director and Endings

## Data
```ts
// journal.ts
interface JournalPage { id: 1|2|3|4|5; location: SpawnRef; text: string; unlocks?: RecipeId }
interface ClueDef { id: string; zone: ZoneId; source: 'tombstone' | 'examine' | 'environment' | 'ledger'; text: string; requires?: ItemId }
// scares.ts
interface ScareEventDef {
  id: 'statue-turn' | 'candle-snuff' | 'whisper-name' | 'breath-behind' | 'door-slam' | 'lurker-lunge' | 'hand-from-grave' | 'false-quiet'
  tier: 'minor' | 'major' | 'none'
  telegraph: { cue: AudioCueId | 'flicker' | 'silence'; lead: number }   // lead 0.5–1.5 s
  subtitle: string                                                       // shown at intensity Off and with subtitles on
  weight: number
}
interface ScareZone { id: string; zone: ZoneId; bounds: Box3Like; events: ScareEventDef['id'][] }
```

## Scare director (pure, `src/game/systems/scareDirector.ts`)
```ts
tickScares(state, dt, ctx: { enteredZones: string[]; lanternFuel; phase; nearCandle; uiBlocking; intensity; events }, rng)
  → { state, cues: ScareCue[] }
```
- `chance = clamp(0.35 + (fuel<30 ? 0.25 : 0) + (night ? 0.15 : 0) − (nearCandle ? 0.30 : 0), 0, 0.95)`
- Picks a weighted event from the zone's list, excluding the zone's last event and any major event while the major cooldown is active.
- Output `ScareCue` = `{ eventId, phase: 'telegraph' | 'beat', at, intensityProfile }`. The scene layer (`src/scene/scares/`) stages the actual effect.
- `uiBlocking` suppresses rolls (no queued scares).
- The first-scare rule is a `firstScareDone` flag in state.

### Intensity profiles
| | Full | Reduced | Off |
|---|---|---|---|
| Stinger volume | 1.0 | 0.4 | 0 |
| Lunge speed | 6 m/s | 4 m/s | 4 m/s |
| Camera shake | per setting | 0 | 0 |
| Subtitle | if enabled | if enabled | always |

## Mystery state (`mystery.ts`)
```ts
interface MysteryState { pages: Set<1|2|3|4|5>; clues: Set<string>; relics: Set<RelicId>; gates: Record<GateId, boolean>; riteProgress: number; ending?: EndingId }
```
- `collectPage`, `discoverClue`, `collectRelic`, `openGate(gate, inventory)`, `tickRite(state, dt, holding)`, `chooseEnding(relicCount)`.

## Scene layer
- `ScareZoneVolume`: Rapier sensor colliders that report enter events to the loop.
- `ScareStager`: maps cues to staged effects (rotate statue while the player isn't looking, by checking the camera frustum; extinguish candle lights sequentially; spawn a Lurker in a niche; door hinge animation).
- Telegraph audio comes from the side of the event (spatial).

## Save format
`localStorage['lastrites:save']` = JSON `{ version: 1, world, player, inventory, mystery, chapel }` with Sets serialized as arrays. Load validates the version and shape; on failure it returns `null`.

## Endings
In-engine camera paths (drei `CatmullRomCurve3`) over the cemetery; text lines appear as handwritten subtitles. Credits are parsed from `docs/CREDITS.md`, bundled at build time with `?raw` import.

## Testing
- Unit: gate opening needs the right key; the first scare is statue-turn; journal page 3 emits `journalRead(3)`; rite progress pauses on release.
- Property (fast-check):
  - over any sequence of zone entries and time steps, two major scares are never closer than 45 s, and never fire while `uiBlocking`
  - a zone never repeats the same event consecutively
  - `chance` always stays within [0, 0.95]
  - `chooseEnding` is total and monotonic in relic count
  - `load(save(state))` round-trips any valid state
