---
inclusion: always
---
# Accessibility and Comfort (non-negotiable)

Horror and first person can exclude players. These settings are required features and must exist from the first playable build.

## Required settings (Settings menu, saved in localStorage)
| Setting | Options | Default |
|---|---|---|
| Scare intensity | Full / Reduced / Off | Full |
| Flashing lights | On / Off | On |
| Camera shake | On / Off | On |
| Head bob | On / Off | On |
| Field of view | 60–100 | 75 |
| Mouse sensitivity | 0.1–3.0 | 1.0 |
| Invert Y | On / Off | Off |
| Subtitles | On / Off | On |
| Master / music / SFX volume | 0–100 each | 80 / 60 / 80 |
| Brightness (gamma) | 0.8–1.4 | 1.0 |
| Accessible HUD | On / Off (adds numeric values) | Off |
| Tutorial prompts | On / Off | On |
| Damage numbers | On / Off | On |

## Rules
- Show a **content warning screen** before the title screen: jumpscares, flashing lights, and a link to the settings.
- `prefers-reduced-motion` turns off shake and head bob by default.
- All controls can be rebound, and every action has a keyboard binding.
- Information is never conveyed by colour alone: craftable items glow **and** show a small rune icon; headshot markers and damage numbers add a shape or symbol, and every compass marker is a glyph with text.
- Pulses, flashes, muzzle flashes and lightning obey **Flashing lights**; with it off they become steady or slow changes. Any shake (recoil, thunder, impacts) obeys **Camera shake**.
- Every important sound (gunfire nearby, board breaking, boss attacks, thunder, an elite's arrival) has a subtitle.
- Cutscenes can be skipped with Space or Enter, and Esc still pauses.
- Pause (Esc) is always available, including mid-scare.
- Every menu and overlay can be navigated with the keyboard and has visible focus states.
