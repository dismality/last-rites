# Kiro Development Log

How Kiro was used to build Last Rites. Entries are added as work happens (see `.kiro/steering/kiro-log.md` for the format).

---

### 2026-10-31: Project planning
- **Kiro feature used:** steering, specs, hooks
- **What happened:** Set up the `.kiro/` folder: 8 steering docs (product, tech, structure, horror design, visual style, accessibility, MCP usage, log rule), 5 feature specs, 6 hooks and the context7 MCP server. Game content lives in `docs/game-design.md`, which steering includes by file reference.
- **What Kiro caught or sped up:** _(fill in after the first Kiro session)_

### 2026-11-01: Setup check + 01-foundation spec review
- **Kiro feature used:** spec review, context7 MCP (library version lookup), hook migration
- **What happened:** Full pre-code setup audit: read all steering docs, specs, hooks and mcp.json. Reviewed 01-foundation requirements, design and tasks against steering and game-design.md. Used context7/web search to verify current library versions. Rewrote design.md and tasks.md with fixes. Updated tech.md stack table. Migrated all 6 hooks from the old proprietary format to the v1 JSON schema Kiro expects.
- **What Kiro caught or sped up:** 10 issues found and fixed before a single line of code was written:
  1. **Version stack mismatch** — spec said React 18 + R3F 8 + drei 9 + rapier 1 + postprocessing 2; current cohesive set is React 19 + R3F 9 + drei 10 + rapier 2 + postprocessing 3. Mixing major versions breaks peer deps silently.
  2. **`<Physics>` outside `<Suspense>`** — rapier v2 lazy-inits WASM; mounting without Suspense throws at runtime. Architecture diagram corrected.
  3. **Postprocessing v3 API** — `kernelSize` on `<Bloom>` was removed; replacement is `mipmapBlur`. Props updated in design and task 9.
  4. **Fog placement ambiguity** — original listed fog as part of the "postprocessing chain." `FogExp2` and EffectComposer are separate mechanisms; conflating them causes two competing fog states. Clarified in design and task 9.
  5. **`lanternRadius` floor wrong in property test** — requirement 3.3 sets the floor at 1.5 m (ember glow), not 2 m. Property test bounds corrected from [2, 8] to [1.5, 8].
  6. **Task 1 underspecified** — no exact package names/ranges listed; added full install command and a build-passes gate before moving to task 2.
  7. **Task 12 had no verifiable exit criteria** — replaced vague description with a 10-item smoke-test checklist mapped to acceptance criteria.
  8. **Missing scope guard** — no explicit list of what is out of scope for this spec; added section to prevent audio/save scope-creep into the foundation pass.
  9. **System type signatures imprecise** — `events[]` is not valid TypeScript; corrected to use the `GameEvent` union type defined in task 2.
  10. **`<Frustum>` component cited that doesn't exist** — drei 10 has no `<Frustum>` component. Replaced with a note to rely on three.js's built-in `InstancedMesh` frustum culling (`frustumCulled={true}`).

### 2026-11-01: 01-foundation task 1: project scaffold
- **Kiro feature used:** spec task, steering (tech, structure)
- **What happened:** Scaffolded Vite + React 19 + TypeScript 7 project manually (npm create is interactive). Installed 9 runtime deps and 12 dev deps. Created all config files (vite.config.ts, tsconfig × 3, vitest.config.ts, eslint.config.js, .prettierrc, index.html) and the full folder skeleton from structure.md (18 directories). `npm run build` and `npm run test` both pass.
- **What Kiro caught or sped up:** Two issues caught before they became blockers: (1) `typescript-eslint@8` doesn't yet support TypeScript 7 — used `--legacy-peer-deps` for the lint-only toolchain while keeping TS7 for the compiler. (2) Vitest 5 requires `globals: true` in config to expose `describe`/`it` without explicit imports — the default changed from v4; adding this and `"types": ["vitest/globals"]` to tsconfig fixed the failing test suite immediately.
