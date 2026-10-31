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

## Rules
- Show a **content warning screen** before the title screen: jumpscares, flashing lights, and a link to the settings.
- `prefers-reduced-motion` turns off shake and head bob by default.
- All controls can be rebound, and every action has a keyboard binding.
- Information is never conveyed by colour alone: craftable items glow **and** show a small rune icon.
- Pause (Esc) is always available, including mid-scare.
- Every menu and overlay can be navigated with the keyboard and has visible focus states.
