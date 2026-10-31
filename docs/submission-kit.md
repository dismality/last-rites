# Submission Kit

Drafts for the Devpost form. Fill in the brackets near the end of the project.

---

## Devpost: project description (draft)

**Last Rites** is a first-person survival-horror mystery that runs in your browser.

You are the new gravekeeper of Hollowmere Cemetery. Your predecessor vanished, and the dead have started digging *out*. By day you search the cemetery for bones, nails, wax and holy water, examine clues in 3D and read the missing keeper's torn journal. By night you survive waves of the unrested dead with weapons you crafted yourself, and some of them wait in the dark alleys between the mausoleums.

**Why it fits Costume Contest:** the spooky interface is how you play.
- Your **health is the lantern flame**, and your light radius *is* your fuel gauge.
- The **workbench glows** to show what you can craft.
- The **map is the keeper's pencil sketch**, inking itself in as you explore.
- The **journal underlines clues** in ink as you find them.

**Comfort settings:** scare intensity Full/Reduced/Off, no-flash mode, FOV, head-bob toggle, subtitles for every important sound, rebindable keys.

**Built with:** React Three Fiber, Rapier physics, zustand, Howler.js, fast-check, Vite, TypeScript and Kiro.

---

## "How Kiro was used" write-up (outline)

Fill each section from `docs/kiro-log.md`. Give concrete examples and numbers.

1. **Kiro apps used:** IDE for spec-driven building; [CLI / Web / Crew, if you tried them] for […]. How they differed: […]
2. **Spec-driven development:** 5 specs, ~50 tasks, every task traced to EARS requirements. Compare spec-driven work with vibe coding on this project, e.g. "the scare director spec stopped scope creep".
3. **Steering:** 8 docs. The biggest win was […], e.g. `horror-design.md` made every generated scare include a telegraph and intensity scaling without being asked. Mention `#[[file:docs/game-design.md]]` making the design bible the single source of truth.
4. **Hooks:** 6 hooks. Examples:
   - The test-on-save hook caught […]
   - The accessibility audit caught a scare that ignored "Off"
   - The asset-license check kept the credits complete
5. **Property-based testing:** fast-check on inventory, crafting, combat, waves, scare director and save/load. Name 1–2 real bugs it found (shrunk counterexamples are great evidence).
6. **MCP:** context7 for current R3F, drei and Rapier APIs. Give an example where it prevented outdated code.
7. **Powers / custom agents:** […]
8. **What I'd do differently:** […]

---

## Demo video script (under 2:50)

| Time | Shot | Voice-over / on-screen text |
|---|---|---|
| 0:00–0:10 | Black, then a lantern flicks on in fog | "The last gravekeeper of Hollowmere vanished. Now it's your job." |
| 0:10–0:30 | Daytime exploration, pick up bones, examine the crypt key in 3D | Show the self-drawing map and the hidden-mark clue |
| 0:30–0:50 | Workbench: items glow, craft the bone club | "The UI is part of the world: what glows, you can make." |
| 0:50–1:10 | Dusk bell, sky turns red, fall back to the chapel | Show the lantern-flame health and fuel |
| 1:10–1:40 | Night wave: melee, holy-water flask, wailer scream | Fast cuts |
| 1:40–2:00 | Mausoleum alley: telegraph, then lurker jumpscare | Let it land; no voice-over |
| 2:00–2:15 | Settings: scare intensity Off, same scare plays with subtitle only | "Horror for everyone." |
| 2:15–2:40 | Kiro: specs, a hook firing, a property test failing then passing | "Built spec-first with Kiro." |
| 2:40–2:50 | Title card, play URL, GitHub URL | |

**Recording tips:** OBS Studio at 1080p60; record gameplay with the music on its own track; use only CC0 music (e.g. from freepd.com or OpenGameArt CC0 tracks) or your own; upload as Public on YouTube.
