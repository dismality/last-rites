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

## Not needed

- **Hymn board:** it's painted into the chapel model.
- **Boots:** Elias's boots already have `props/clue-hut-boots.glb`, and the boot casts are now built in code from each cast's tread, size and hobnails.
