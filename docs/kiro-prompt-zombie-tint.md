# Kiro prompt: textured zombie colours (11p)

Paste everything below the line into Kiro. It's also part of `kiro-prompt-all.md` (Part A), so skip this if you haven't pasted that yet.

---

A follow-up from the user. Add it to `.kiro/specs/09-playtest-fixes/tasks.md` as **11p**. Finish the step you're on and commit it first, then do 11p, then carry on where you were. Same rules: design bible first, a kiro-log entry, lint, build and unit tests pass, commit locally, never push.

## 11p. The textured zombie keeps its own colours

`public/assets/models/enemies/zombie.glb` is now a realistic, textured gravedigger zombie (see `docs/enemy-models.md`). It still uses the same skeleton, the same 9 clips and the same `ENEMY_LOOKS` ids, so nothing else has to change. But the tinting in `EnemyModels.tsx` and `zombieMaterial.ts` was tuned for the old flat cartoon colours, and on the texture it gives a blue-purple cast at night:
- `tintedMaterial` sets `color` from `adjustZombieColor(white, tint)`, which caps the value at `ZOMBIE_MAX_VALUE` (0.62) and darkens the whole texture;
- `zombieColdFill` adds a blue emissive scaled by that colour, which washes over the texture in the dark.

**Fix:** when the source material has a `map` (a texture), treat it as a textured skin:
- **Shambler** (white tint): leave `color` at white so the texture shows as painted. Keep the roughness, metalness and env settings from `ZOMBIE_MATERIAL_PARAMS`.
- **Other looks** (lurker, wailer, bloater): apply the tint as a gentle multiply on the texture, blended about 50% toward white, so they still read as different without losing the texture. Keep `ZOMBIE_MIN_VALUE` so the lurker stays visible.
- **Cold fill:** make it much weaker on textured skins, around 25% of today's `COLD_FILL`, or remove it if the lantern no longer turns the texture orange. Judge this in Chrome at 1 to 2 m in lantern light, the case the fill was added for (playtest item 7).
- The brute and Father Crane still use the untextured Quaternius brute, so keep today's path for materials without a `map`.

Keep the maths pure in `zombieMaterial.ts`, add unit tests for the textured branch, and take screenshots at night: the shambler, lurker and wailer at 2 m in lantern light and at 8 m in fog, at 1280x720.
