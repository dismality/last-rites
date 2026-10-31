---
inclusion: always
---
# Horror Design Rules

Apply these to any work on scares, enemies, audio, lighting, level layout or pacing.

## Tension curve
- Alternate **tension** (dark, quiet, confined) and **release** (lit chapel, workbench, dawn). Never keep the player at maximum tension for more than ~90 seconds.
- Silence is a tool: drop ambient audio 1–2 seconds before a major scare.
- The first scare of the game happens within the **first 3 minutes** and is mild (the statue that turned its head). Escalate from there.

## Jumpscare contract
Every scripted scare MUST:
1. Be **telegraphed** 0.5–1.5 s beforehand (flicker, creak, breath, music drop).
2. Respect `settings.scareIntensity`:
   - `full`: loud stinger, fast lunge, camera shake
   - `reduced`: quieter stinger, slower lunge, no shake
   - `off`: the event still happens for gameplay purposes, but no stinger, no shake, and an on-screen subtitle describes it
3. Have a **cooldown** (minimum 45 s between major scares) so they don't lose impact.
4. Show a **subtitle** for its key sound when subtitles are enabled.
5. Never fire during crafting, the satchel, the journal or pause.

## Light as a resource
- The lantern is the player's main light. Its radius shrinks with fuel, and darkness raises the chance of a scare.
- Zombies avoid strong light briefly but are never stopped by it entirely.
- Never make a required path completely black: keep a faint moonlight rim or other silhouette.

## Sound
- Use spatial (3D) audio for all enemy and scare sounds so direction carries meaning.
- Whispers come from the side the threat will appear on.
- Every zombie type has a distinct audio signature recognisable before it is seen.

## Taboos
- No cheap deaths: a scare can never kill the player outright.
- No real-world religious mockery; the "rite" is fictional and treated seriously.
- No gore close-ups; violence reads through silhouettes, sound and particle dust.
