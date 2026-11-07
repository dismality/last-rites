# Enemy Models

Two rigged, animated zombies in `public/assets/models/enemies/`, converted from CC0 Quaternius models by `tools/blender/prep_zombies.py`. Rerun that script to change the colours, clips or scale; don't edit the `.glb` files by hand.

| File | Height | Triangles | Size | Clips |
|---|---|---|---|---|
| `zombie.glb` | 1.75 m | 7,822 | 545 KB | `Idle` `Walk` `Run` `Crawl` `Attack` `Lunge` `Threaten` `HitReact` `Death` |
| `zombie-brute.glb` | 1.95 m | 3,550 | 226 KB | `Idle` `Walk` `Run` `Attack` `HitReact` `Death` |

`zombie.glb` is the main model. `zombie-brute.glb` is blockier and matches the rest of the game less well, so it's optional variety.

## What changed from the source
- **Colour:** the bright green cartoon skin is regraded to a pale corpse tone, reds to dried blood and clothes to cold, dull cloth. Materials are non-metallic with a roughness of 0.8.
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
