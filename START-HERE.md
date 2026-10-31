# START HERE: Last Rites build guide

Your step-by-step guide from an empty machine to a submitted Kiroween entry.
**Deadline: Friday, December 4, 2026, 2:00 PM PT.** Aim to submit on **Dec 3**.

---

## 0. What's in this folder

| Path | What it is |
|---|---|
| `.kiro/steering/` | 8 rule files Kiro reads automatically (product, tech, structure, horror, visual style, accessibility, MCP, log rule) |
| `.kiro/specs/01…05/` | 5 feature specs, each with `requirements.md`, `design.md` and `tasks.md` |
| `.kiro/hooks/` | 6 automations (tests on save, scare audit, asset licenses, data checks, performance review, log update) |
| `.kiro/settings/mcp.json` | context7 MCP server (current library docs) |
| `docs/game-design.md` | **Design bible**: every item, recipe, enemy, wave, scare and story beat |
| `docs/kiro-log.md` | Log of Kiro usage, needed for your write-up |
| `docs/CREDITS.md` | Asset credits |
| `docs/submission-kit.md` | Devpost description draft, write-up outline, video script |
| `README.md`, `LICENSE`, `.gitignore` | Repo basics |

---

## 1. One-time setup (≈1 hour)

### Install
| Tool | Why | Get it |
|---|---|---|
| **Kiro** | Required; the IDE you build in | https://kiro.dev → Download for Windows, then sign in |
| **Node.js 20 LTS or 22 LTS** | Runs the project | https://nodejs.org |
| **Git** | Version control | https://git-scm.com |
| **GitHub account** | Public repo for judging | https://github.com |
| **Vercel account** | Free hosting so judges can play | https://vercel.com (sign in with GitHub) |
| **OBS Studio** | Recording the demo video | https://obsproject.com |
| *(optional)* **Blender** | Tweak or recolour models | https://blender.org |

Check in a terminal:
```bash
node -v
```
```bash
git --version
```

### Get the free credits
Request **4,000 free Kiro credits** on the hackathon's Resources tab (https://kiroween.devpost.com/resources) **before Dec 1, 12:00 PM PT**. Do it today.

### Kiro extensions
Kiro uses the Open VSX marketplace (Extensions panel, Ctrl+Shift+X). Install:
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **Error Lens** (usernamehw.errorlens): shows errors inline
- **Vitest** (vitest.explorer): run and debug tests from the sidebar
- **glTF Tools** (cesium.gltf-vscode): preview `.glb` models
- *(optional)* **Code Spell Checker**: catches typos in journal text

### Join Discord
https://discord.gg/kirodotdev → `#kiroween-hackathon`. Useful for help and office hours.

---

## 2. Create the repo (≈15 min)

1. **Fill in your name** in `LICENSE` (replace `YOUR NAME HERE`).
2. On GitHub, create a **new public repository** called `last-rites`. Do **not** add a README, license or .gitignore there (you already have them).
3. In a terminal inside this folder (`C:\David\last-rites`):
   ```bash
   git init
   ```
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Project planning: Kiro steering, specs and hooks"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/last-rites.git
   ```
   ```bash
   git push -u origin main
   ```
4. On GitHub, confirm that **MIT License** appears in the About sidebar and that the `.kiro` folder is visible in the file list.

---

## 3. Open it in Kiro and check everything loads (≈15 min)

1. Kiro → **File → Open Folder** → `C:\David\last-rites`.
2. Click the **Kiro ghost icon** in the left sidebar. You should see:
   - **Specs:** 01-foundation … 05-mystery-scares
   - **Agent Steering:** the 8 docs
   - **Agent Hooks:** the 6 hooks
   - **MCP Servers:** context7 (it may take a minute to start the first time)
3. **Hook format check (important):** Kiro's hook file format can change between versions. In the Hooks panel, click **+** and create any throwaway hook through the UI, then open the file it creates in `.kiro/hooks/`. If its JSON shape differs from mine (field names like `when`, `then`, `patterns`), ask Kiro:
   > Convert every hook in .kiro/hooks/ to match the format of the hook I just created through the UI, keeping their triggers and prompts. Then delete the throwaway hook.
4. If a hook or steering doc doesn't appear, tell me what you see and I'll fix the format.

---

## 4. Build with Kiro: what to say

Work **one spec at a time, in order**. For each spec:

1. **Open the spec** in the Kiro panel and read `requirements.md`.
2. **Let Kiro review it first.** This counts as using spec-driven development for the write-up:
   > Review the requirements and design for this spec against the steering docs and docs/game-design.md. Point out gaps, contradictions or anything too big for a 5-week solo hackathon, then update the design and tasks.
3. **Run tasks** with the **"Start task"** button next to each task in `tasks.md`, one at a time.
4. **After each task:** run the game (`npm run dev`), check it works, then commit:
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Foundation task 3: settings system"
   ```
5. **At the end of each session**, run the **"Update Kiro usage log"** hook from the Hooks panel.

### Prompts for specific moments

**Starting spec 01 (first-ever task):**
> Start task 1 of 01-foundation. The folder already has README.md, LICENSE, .gitignore, docs/ and .kiro/. Scaffold Vite into this folder without overwriting those files; merge .gitignore entries instead. Use context7 to check current versions of the R3F packages listed in tech.md.

**When something looks wrong in the game:**
> When I [do X], [Y happens] but I expected [Z]. Find the cause, fix it, and add a test so it can't come back.

**When performance drops:** run the **Performance review** hook.

**When you want to change the design** (for example a new weapon): edit `docs/game-design.md` first, then:
> I updated the design bible: [describe]. Update src/data and any affected spec requirements and tasks.

**To try Kiro Crew / parallel agents (good for the write-up):** once spec 01 is done, specs 02 and 04 can be built in parallel because they touch different folders. Run each in its own agent and note in `docs/kiro-log.md` how it went.

**To try the Kiro CLI (good for the write-up):**
> (in terminal) `kiro-cli chat` then: "Run all tests and summarise any property-test failures with their shrunk counterexamples."

### Recommended order and timeline
| Dates | Work | Done when |
|---|---|---|
| Oct 31 – Nov 9 | **Spec 01** foundation | Walk the greybox at night with the lantern; settings work; deployed preview |
| Nov 10 – Nov 16 | **Spec 02** exploration + **Spec 03** crafting | Collect, dig, examine, craft at the glowing bench |
| Nov 17 – Nov 23 | **Spec 04** combat and waves | Survive nights 1–2 |
| Nov 24 – Nov 29 | **Spec 05** mystery, scares, endings | Full playthrough to all three endings |
| Nov 30 – Dec 2 | **Polish**: real models, sound, lighting, UI | It looks good in the first 2 minutes |
| Dec 2 – Dec 3 | **Video, write-up, submit** | Submitted a day early |

**If you fall behind,** cut in this order: catacombs zone → nail bomb and lantern trap → chapel repair stage 3 → the Uneasy Peace ending. **Never cut** comfort settings or polish on the first 2 minutes.

---

## 5. Assets (models, sounds, music)

Only use **CC0** (no attribution needed) or **CC-BY** (credit in `docs/CREDITS.md`). The asset-license hook reminds you.

| Need | Source |
|---|---|
| Graves, fences, crypts, props | **Kenney.nl** (Graveyard Kit, CC0), **Quaternius** (CC0), **Poly Pizza** (filter CC0) |
| Zombie / humanoid with animations | **Quaternius** Ultimate Animated Character packs (CC0) |
| Textures | **ambientCG** (CC0), **Poly Haven** (CC0) |
| Sound effects | **Sonniss GDC bundles** (royalty free), **freesound.org** (filter CC0), **Kenney audio** (CC0) |
| Music | **OpenGameArt** (filter CC0), or make your own |

Put files in `public/assets/models|textures|audio/`. Compress models before adding:
```bash
npx @gltf-transform/cli optimize input.glb public/assets/models/output.glb --compress meshopt --texture-compress webp
```

---

## 6. Deploy (once spec 01 is playable)

1. https://vercel.com → **Add New → Project** → import `last-rites` from GitHub.
2. Framework: **Vite**. Build command `npm run build`, output `dist`. Deploy.
3. Every `git push` redeploys automatically. Put the URL in `README.md`.
4. Test the deployed link in a **private window** on another browser. Judges will.

---

## 7. Submit (Dec 2–3)

Use `docs/submission-kit.md`, which has the description draft, write-up outline and video script.

- [ ] Repo public, MIT license shown in About, `.kiro/` present and committed
- [ ] README has the play URL, video link, controls and run instructions
- [ ] `docs/CREDITS.md` complete, no TODOs
- [ ] Game works on the deployed URL in a fresh private window
- [ ] Video under 3:00, public on YouTube, CC0 music only
- [ ] Devpost: category **Costume Contest**, plus any bonus prizes you want to be considered for
- [ ] Devpost: repo URL, app URL, description, video URL, Kiro write-up
- [ ] Submitted before **Dec 4, 2:00 PM PT**

---

## 8. Other tips

- **Commit every day.** Your git history is your proof the project was built during the submission period. Don't squash or rewrite it.
- **Log as you go.** Run the log hook after each session. Screenshots of Kiro panels, hook output and failing property tests are great for the write-up and video. Save them to `docs/screenshots/`.
- **Don't edit `.kiro/` into `.gitignore`.** That can disqualify you.
- **Keep it original.** Don't copy layouts, names or mechanics from specific commercial games.
- **Test on a weaker machine** or with the browser at 1080p before recording.
- **No real names or trademarks** in the game or video.
- **Ask me anytime:** if Kiro gets stuck, paste the error or the spec task here and I'll help debug, rewrite a spec or adjust the plan.
