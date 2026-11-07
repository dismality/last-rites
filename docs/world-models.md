# World Models

80 cemetery props in `public/assets/models/world/`, converted from Kenney's Graveyard Kit (CC0) by `tools/blender/prep_kenney_graveyard.py`. Rerun that script to change the colours or scale; don't edit the `.glb` files by hand.

## What changed from the kit
- **Colour:** the shared palette texture is regraded from bright toy colours to cold stone, dim moss and rust.
- **Scale:** sizes are in metres and fit a 1.7 m player.

| Group | Scale | Examples at final size |
|---|---|---|
| Graves, fences, stone walls, small props | x1.5 | `gravestone-cross` 1.37 m tall, `iron-fence` 1.5 m wide |
| Coffins | x2.0 | `coffin` 1.68 m long |
| Crypts, brick walls, pillars, lamp posts | x2.4 | `crypt-large` walls 2.4 m tall, `lightpost-single` 3.04 m tall |
| Pines | x3.0 | `pine-crooked` 6.3 m tall |

- **Left out:** the five toy-style characters, pumpkins and hay bales, which don't fit the mood.

## Using them
- **Pivots** sit at ground level, so place props at `y = 0`. A few, like `pine-crooked`, reach slightly below the ground on purpose.
- **Crypts are built from parts.** Place `crypt-large` and `crypt-large-door` at the same position, then `crypt-large-roof` at the same position raised by **2.4 m**.
- **Crypt doorway:** the `crypt-large-door` opening is 1.77 m tall, which is tight for the 1.7 m player capsule. Test it if players walk through.
- **Repeated props:** each file is one or two meshes, so use `<Instances>` for graves and fences.

## Loading (world and hero models)
All models use Draco compression, and the world models use WebP textures. Both load with three.js `GLTFLoader` and were tested that way.

drei's `useGLTF` fetches its Draco decoder from a CDN by default. To remove that dependency, copy `node_modules/three/examples/jsm/libs/draco/gltf/` to `public/draco/` and pass `/draco/` as the decoder path.

Hero item details are in `docs/hero-items.md`.
