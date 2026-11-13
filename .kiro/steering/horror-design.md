---
inclusion: always
---
# Horror Design Rules

Apply these to any work on scares, enemies, audio, lighting, level layout or pacing.

## Tension curve
- Alternate **tension** (dark, quiet, confined) and **release** (lit chapel, workbench, dawn). Never keep the player at maximum tension for more than ~90 seconds.
- Silence is a tool: drop ambient audio 1–2 seconds before a major scare.
- The first scare of the game happens within the **first 3 minutes** and is mild (the statue that turned its head). Escalate from there. The first puzzle minigame is also reachable within the first 3 minutes (stage 1's ledger cross-check, from the hut).
- **Endless night waves:** each stage's night has no fixed end, so release cannot come from clearing waves. Release comes from (a) the gap between waves (a wave begins 20 s after the last zombie falls), (b) the lit, barred chapel and the altar, and (c) solving the case, which ends the night. Day has no zombies at all and is the long release; Lurkers and every other zombie are night-only.
- Waves escalate but are capped (12 / 16 / 20 alive); never let the endless night run at maximum tension past ~90 seconds without a gap.
- At night the journal does not pause; the screen dims and sound goes on. No scare begins while it is open. A wrong altar answer is a pressure spike (an instant wave and a 30 s lock), never a cheap death.
- Grab kill-cams (a close-up when a Brute, Lurker or Sprinter seizes the player) happen at most once every 60 s and follow the scare intensity setting.

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
