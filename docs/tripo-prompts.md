# Tripo prompts: models code can't build well

The simple props are now detailed models built in code (2026-11-21). That covers:

- the first-person hands and lantern;
- the bell posts, psalter, hymn tiles, evidence, slate, crypt door and body;
- the walk clues, logbook, crest niche and boot casts;
- the altar relics, which use their item GLBs.

Bats, items and world props already have GLBs.

These still need a real model. Make each one in Tripo (or TRELLIS) and export a GLB to the path shown. The game picks the file up by itself when it exists. Until then it keeps using the stand-in.

## Rules for every model

- **Format:** GLB, metres, Y up, facing **+Z**, with the feet (or base) at `y = 0`.
- **Size:** under about 15k triangles, with one 1024 px texture. Draco compression is fine.
- **Style:**
  - realistic and grim, in a Victorian graveyard in October 1891;
  - muted colours, with no bright saturation;
  - no text or logos.
- **Creatures:** these must be rigged to play the game's clips. Use the pipeline in `docs/enemy-models.md` (`tools/blender/trellis_zombie/`): bake to 12k, rig onto the Quaternius skeleton, then measure the feet. Generate them in a **T-pose**.

## 1. Pale Crawler: `public/assets/models/enemies/crawler.glb`

> Full-body 3D character, a starved corpse that crawls on all fours. It has grey-white waxy skin stretched over its ribs and spine, long thin arms with cracked fingernails, a hairless head, sunken eyes and torn burial rags at the waist. Realistic, horror, Victorian era. T-pose, arms out, neutral expression.

Height standing is about 1.6 m; it plays the zombie's `Crawl` clip.

## 2. Hollow Bride: `public/assets/models/enemies/bride.glb`

> Full-body 3D character: a Victorian bride ghost. She wears a long, tattered, yellowed lace wedding dress and a veil over her face. She is barefoot, with thin pale arms, a hollow dark face behind the veil, a dirt-stained hem and a wilted bouquet tied at her wrist. Realistic, horror, 1890s. T-pose.

She is about 1.7 m tall. The long skirt hides the legs, so the walk clip only needs to sway it.

## 3. Corpse Hound: `public/assets/models/enemies/hound.glb`

> 3D model of a dead mastiff-sized dog: emaciated, patchy grey fur, exposed ribs and spine, milky eyes and a lean wolf-like build. A broken iron collar hangs from its neck. Realistic, horror, standing pose, legs straight.

It's about 0.8 m at the shoulder and 1.4 m long.

**Note:** the zombie rig is humanoid, so it can't drive a dog. The hound needs its own quadruped rig and clips (`Idle`, `Run`, `Attack`, `HitReact`, `Death`), for example from Mixamo's animal packs or the Quaternius animal kit. Until it has them, the game keeps the tinted zombie.

## 4. Optional: rigged hands (`public/assets/models/viewmodel/hands.glb`)

The code-built hands already close around each weapon's grip. A GLB is only worth making if you want skin detail such as veins, dirt and wrinkles.

> First-person pair of hands and forearms. They're a man's hands, weathered and dirty, with short nails and visible veins. A dark wool coat sleeve has a turned-back cuff and brass buttons, with a linen shirt cuff showing. Realistic, Victorian. Hands open, palms facing each other.

It also has to be rigged with finger bones in Blender, with these clips: `Grip-Pistol`, `Grip-Haft`, `Grip-Long`, `Lantern-Hold`, `Throw`, `Reload-Revolver`, `Reload-Shotgun`, `Swing-Light` and `Swing-Heavy` (`HANDS_CLIPS` in `src/data/viewmodel.ts`). That's more work than the rest put together. Skip it unless the code hands look wrong.

## 5. Optional: lantern (`public/assets/models/viewmodel/lantern.glb`)

> Victorian keeper's cage lantern: a brass oil fount, a bulging glass globe, four iron guard wires, a vented iron hood and a carrying ring on top. Realistic and worn, with soot on the glass. About 18 cm tall.

Put its origin at the **glass centre**, where the light anchors. Name the globe mesh `glass` and the flame mesh `flame` (`LANTERN_MESHES`), so the flicker drives them.

## 6. Realism pass: drop-in replacements for code-built props

The 2026-11-22 realism pass reworked these in code:

- surface detail on every world material;
- wind-blown grass, ground mist and a deeper hut;
- five carved gravestones.

Code still falls short on **sculpted, organic shapes**. These three props are drop-in: export over the file, and the game loads it with no code change. Keep each one's size, origin and facing, or its collider stops matching it.

### Mourner statue: `public/assets/models/props/statue-mourner.glb`

> Weathered Victorian cemetery statue of a mourning woman in a hooded robe, head bowed, hands clasped at her chest, on a square stone plinth. Grey limestone with green-black lichen, rain streaks and a chipped nose and fingers. Realistic. Facing forward.

It must fit **0.86 m square at the base and 1.9 m tall**, with the base at `y = 0` and the face toward +Z (`statue-mourner.json`). The scare turns the whole model, so it needs no rig.

### Grave hand: `public/assets/models/props/grave-hand.glb`

> A rotting human hand and forearm reaching up out of the soil, fingers clawed, grey-green skin with torn nails and a scrap of burial cloth at the wrist, clumps of wet earth around it. Realistic, horror.

Put the soil line at `y = 0`. It's about 0.45 m above ground.

### Broken coffin: `public/assets/models/props/coffin-broken.glb`

> An old Victorian wooden coffin half-rotted, lid split and pushed aside, dark warped boards with rusted iron handles and nails, dirt and roots inside. Realistic.

Match the current coffin's length, about 2 m. Its base goes at `y = 0`.

Before committing any of these, check them in game: `node tools/video/looks.mjs tools/video/out/looks <tag>`.

## Not needed

- **Gravestones, hut, chapel, grass, mist, wall and wood surfaces:** these are all built in code (see section 6).

- **Hymn board:** it's painted into the chapel model.
- **Boots:** Elias's boots already have `props/clue-hut-boots.glb`, and the boot casts are now built in code from each cast's tread, size and hobnails.
