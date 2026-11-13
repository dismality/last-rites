# Enemy Models

Two rigged, animated zombies in `public/assets/models/enemies/`.

- `zombie.glb` is a realistic gravedigger zombie made with Microsoft TRELLIS.2, put on the Quaternius skeleton and clips by `tools/blender/trellis_zombie/` (2026-11-14):
  1. `bake.py` reduces the TRELLIS mesh to 12k triangles and bakes its colour onto new UVs (1024 px JPEG).
  2. `rig.py` finds the joints inside the new body, builds the bind pose and skin weights, and copies the 9 clips. glTF clips store absolute joint rotations, so the motion is the original; only joint offsets and the Body height are scaled to the longer legs.
  3. `measure.py` compares the lowest point of the old and new zombie at every Body key, and `rig.py` (third argument) applies those deltas so the feet land where the old zombie's did.
  The old Quaternius body is backed up outside the repo at `C:\David\tripo\zombie-quaternius-original.glb`.
- `zombie-brute.glb` is still the CC0 Quaternius model converted by `tools/blender/prep_zombies.py`.

| File | Height | Triangles | Size | Clips |
|---|---|---|---|---|
| `zombie.glb` | 1.78 m | 11,999 | 1.7 MB (1024 px texture) | `Idle` `Walk` `Run` `Crawl` `Attack` `Lunge` `Threaten` `HitReact` `Death` |
| `zombie-brute.glb` | 1.95 m | 3,550 | 226 KB | `Idle` `Walk` `Run` `Attack` `HitReact` `Death` |

`zombie.glb` is the main model. `zombie-brute.glb` is blockier and matches the rest of the game less well, so it's optional variety.

## What changed from the source
- **Colour (brute only now):** the bright green cartoon skin is regraded to a pale corpse tone, reds to dried blood and clothes to cold, dull cloth. Materials are non-metallic with a roughness of 0.8.
- **Clips:** duplicates are removed and names are shortened to the list above.
- **Scale:** a new `Root` node sets the height. The skeleton and animation data are unchanged from the source.

## Which model each enemy uses
| Enemy state | Shambler | Lurker | Wailer |
|---|---|---|---|
| Waiting | `Idle` | `Idle`, paused on one frame | `Idle` |
| Moving | `Walk` | `Crawl` or `Run` | `Walk` |
| Attacking | `Attack` | `Lunge`, then `Attack` | none |
| Screaming | none | none | `Threaten` plus the wail sound |
| Hit (stagger) | `HitReact` | `HitReact` | `HitReact` |
| Dying | `Death` | `Death` | `Death` |

All three use `zombie.glb`. Tell them apart with a material tint and a small scale change, such as a paler Wailer at x0.92.

## Clips that don't exist
- **Scream:** neither model has one. `Threaten` is the closest, and the sound does the rest.
- **Rising from the ground:** the `rise` state has no clip. Play `Death` backwards (`timeScale = -1`, starting at the end of the clip) while moving the model up out of the soil.

## Using them
- **Cloning:** use `SkeletonUtils.clone` from `three/addons/utils/SkeletonUtils.js` for every enemy. A plain `.clone()` leaves the copies sharing one skeleton, so they break or move together.
- **Tints:** clones share a material, so clone the material before tinting one enemy type.
- **Direction:** models face **+Z**.
- **Pivots:** feet sit at `y = 0`. Some clips dip up to 0.12 m below that.
- **Movement:** clips play on the spot, so game code moves the enemy. Use `action.timeScale` to stop the feet sliding at each enemy's speed.
- **Death:** `zombie.glb` falls about 1.1 m backwards and `zombie-brute.glb` about 0.8 m, so leave room near walls. Set `clampWhenFinished = true` and `loop = LoopOnce` to keep the body on the ground.
- **Collision:** use a fixed capsule. Raised arms reach 2 m in some clips, so don't size it from the animated bounds.
- **Loading:** these files don't use Draco, and they load with `GLTFLoader` or `useGLTF` as they are.
