# Last Rites: Design Bible

Source of truth for all game content. Code in `src/data/` mirrors these tables. If they disagree, this file wins; update the code.

**Planned content.** Rows and sections tagged **(06)**, **(07)** or **(08)** belong to specs `06-clarity-and-hud`, `07-combat-and-enemies` and `08-progression-and-atmosphere`. They are added to `src/data/` by that spec's data task, not before. Untagged content is already in the game.

---

## 1. Story

### Premise
**Hollowmere Cemetery, 1891.** You arrive as the new gravekeeper. Your predecessor, **Elias Thorne**, disappeared three weeks ago, leaving only a torn journal. Each night since, graves have opened from the inside.

### The truth (revealed over five journal pages)
In the cholera winter of **1849**, parish priest **Father Aldous Crane** sealed sick but *still living* townsfolk in the catacombs beneath the chapel to "contain the pestilence". He recorded them in the parish ledger as buried, and their graves above are empty. To quiet his guilt, he began a **Rite of Rest** to lay their spirits down, but died before finishing it. Elias found the ledger, tried to complete the rite alone and failed. The unrested dead are rising, and Elias is now one of them.

### Journal pages (one unlocked per night chapter)
| # | Found in | Reveals |
|---|---|---|
| 1 | Keeper's hut (start area) | Elias notices graves "dug from the inside" and dates that don't match the ledger |
| 2 | Grounds: grave of the Marsh family | The parish ledger lists 31 burials in one week of 1849 with no death certificates |
| 3 | Mausoleum Row: Crane family crypt | Crane's confession fragment; **teaches the Salt Circle recipe** |
| 4 | Catacombs: sealed ossuary | Scratch marks, names on the walls, the five relics of the rite |
| 5 | Altar (after collecting 3+ relics) | Elias's last entry: "Finish it, whoever you are. Do not let me out." |

### Endings
| Relics collected by night 5 | Ending |
|---|---|
| 5 | **Rest**: the rite is completed, the dead lie down, and Elias's spirit thanks you at dawn. |
| 3–4 | **Uneasy Peace**: the rite holds for now, and the final shot shows one grave still trembling. |
| 0–2 | **Taken**: dawn comes, and you are listed in the ledger. |

---

## 2. Zones

| Zone | Access | Feel | Contents |
|---|---|---|---|
| **Keeper's Hut and Grounds** | Start | Open, foggy, crooked headstones, dead oaks | Workbench, most materials, 2 relics, the chapel exterior, the woodpile with the **Wood Axe (07)** |
| **Mausoleum Row** | **Rusted Crypt Key** (found night 1, Marsh grave) | Narrow stone alleys, dark, echoing, statues | Scare alleys, Crane crypt (with the **Silver Sabre (07)**), the gatekeeper's lodge with the **Double-Barrel Shotgun (07)**, 1 relic |
| **Chapel** | Always (repair to make it a safe zone) | Ruined, candlelit | Altar, bell, repairs, front door and **vestry door (07)**, the vestry cupboard with the **Service Revolver (07)** |
| **Catacombs** | **Sexton's Bone Whistle** (Mausoleum Row) opens the hidden stair behind the altar | Tight tunnels, bone walls, drips, near-total dark | Ossuary, 2 relics; **Iron Ossuary Key** (on Elias's body in the Crane crypt) opens the deepest chamber |

### Chapel repairs (permanent upgrades)
| Stage | Cost | Effect |
|---|---|---|
| 1. Bar the doors | 4 iron nails, 2 bone | Fits barricade frames on both chapel doors and nails 2 boards on each. **(07)** The chapel is a safe zone while both doors keep at least 1 board. |
| 2. Relight the altar | 3 candle wax, 1 holy water | Saves the game at the altar and heals 25 HP per visit per day |
| 3. Rehang the bell | 6 iron nails, 2 cloth | Bell rings 20 s before each wave and reveals spawn directions on the map (and on the compass **(06)**) |

Before stage 1 is built, the chapel doors stand open and the chapel is not safe. Until spec 07 is in the game, a built stage 1 keeps its old effect: zombies cannot enter the chapel at all.

### Barricades (07)
The chapel has two doors: the **front door** and the **vestry door** in the side wall.

| Rule | Value |
|---|---|
| Board slots per door | 3 |
| Board health | 60 |
| Cost to nail one board | 1 wood plank, 2 iron nails |
| Time to nail a board | Hold Interact for 2 s (cancelled by moving or being hit) |
| When boards can be added | Any phase, once repair stage 1 is built |
| Who attacks the doors | At night, every zombie whose target (the player) is inside the chapel. Also 1 in 3 zombies of each wave (rounded down, minimum 1 from night 2) heads for the nearest door instead of the player. |
| Damage to boards | The zombie's normal hit damage per blow. Brutes deal double. During the final rite all boards take double damage. |
| Door with 0 boards | Open: zombies walk in |
| Board breaks | Splintering sound from that door, with the subtitle "[wood splinters at the front door]" or "[... at the vestry door]" |

Door condition is shown in the world (a small board-count plaque over each door) and on the HUD as "Front door 2/3" and "Vestry 3/3", with board health as numbers.

---

## 3. Items

### Materials (stack limit 10 each)
| ID | Name | Found |
|---|---|---|
| `bone` | Bone | Disturbed graves, catacomb walls. **(09)** The first grave dug on day 1 always yields at least 3 |
| `iron-nail` | Iron Nails | Broken coffins, fences |
| `candle-wax` | Candle Wax | Crypt shelves, chapel |
| `holy-water` | Holy Water | Chapel font (refills daily: 2), rare in crypts |
| `cloth` | Cloth | Shrouds, the hut. **(09)** The hut shelf always holds at least 1 on day 1 |
| `lamp-oil` | Lamp Oil | Hut, mausoleum lamps, one bottle a day on the path from the hut to the oak path at (−6, 0, −8) **(09)** |
| `grave-salt` | Grave Salt | Catacombs, Crane crypt |
| `wood-plank` | Wood Planks | Woodpile by the hut, broken coffins, fences, fallen oaks **(07)** |
| `black-powder` | Black Powder | Powder tin in the hut (1 at the start), bell tower store, crypt shelves (rare) **(07)** |
| `lead-shot` | Lead Shot | Coffin linings (broken coffins), lead flashing on crypt roofs **(07)** |
| `silver-filings` | Silver Filings | Rare: catacomb niches, elite zombies, the merchant **(07)** |

### Ammunition (07)
Each stack takes one satchel slot. Stack limits are higher than materials.

| ID | Name | Stack limit | Found |
|---|---|---|---|
| `revolver-cartridge` | Revolver Cartridges | 36 | Crafted; 6 come with the revolver; elite drops |
| `shotgun-shell` | Shotgun Shells | 20 | Crafted; 4 come with the shotgun; elite drops |

### Currency (08)
`grave-coin`, **Grave Coins**: a counter, not a satchel slot. Dropped by zombies and spent at the dawn merchant.

### Key items (no slot cost, shown in the journal)
`rusted-crypt-key`, `bone-whistle`, `iron-ossuary-key`, `parish-ledger`, `journal-page-1` … `journal-page-5`

### Relics (no slot cost)
| ID | Name | Location |
|---|---|---|
| `crane-rosary` | Crane's Rosary | Crane crypt sarcophagus (Mausoleum Row) |
| `sextons-bell-clapper` | Sexton's Bell Clapper | Under the collapsed bell tower (Grounds) |
| `childs-locket` | Child's Locket | Smallest grave, west hill (Grounds), only appears at night. **(09)** A day clue at (−24.5, 0, 9) says so: "Something small glints on the west hill… but only after dark." |
| `burial-shroud` | Burial Shroud | Ossuary (Catacombs) |
| `reliquary-heart` | Reliquary Heart | Deepest chamber (Catacombs, Iron Ossuary Key) |

### Satchel
- 12 slots. Each material stack, ammunition stack and crafted item takes one slot.
- Key items, relics and Grave Coins don't use slots.

---

## 4. Weapons and tools

| ID | Name | Type | Damage | Speed (s/attack) | Durability | Notes |
|---|---|---|---|---|---|---|
| `rusty-shovel` | Rusty Shovel | Melee | 15 | 0.9 | ∞ | Starting weapon, also digs graves |
| `bone-club` | Bone Club | Melee | 25 | 0.6 | 30 hits | Fast |
| `sharpened-shovel` | Sharpened Shovel | Melee | 35 | 0.9 | 50 hits | Still digs |
| `holy-water-flask` | Holy Water Flask | Thrown | 40 (2 m radius) | — | Single use | Stuns 2 s, double damage to Wailers |
| `lantern-trap` | Lantern Trap | Placed | 10/s burn for 5 s | — | Single use | Triggers on proximity, lights the area |
| `nail-bomb` | Consecrated Nail Bomb | Thrown | 80 (3 m radius) | — | Single use | 2 s fuse |
| `salt-circle` | Salt Circle | Placed | — | — | Lasts 30 s | Zombies cannot cross; 2 m radius |
| `bandage` | Bandage | Consumable | Heals 30 | — | Single use | 2 s to apply |
| `tallow-candle` | Tallow Candle | Placed light | — | — | Burns 120 s | Reduces scare chance nearby |
| `lantern-refill` | Lantern Refill | Consumable | +50% fuel | — | Single use | |
| `revolver` | Service Revolver | Firearm | 34 (headshot ×2) | 0.45 | ∞ | 6 rounds, reload 2.4 s. Chapel vestry. **(07)** |
| `shotgun` | Double-Barrel Shotgun | Firearm | 8 pellets × 9 (headshot ×1.5 per pellet) | 0.3 | ∞ | 2 rounds, reload 2.0 s, 6° spread. Gatekeeper's lodge, Mausoleum Row. **(07)** |
| `wood-axe` | Wood Axe | Heavy melee | 30 (heavy 70) | 0.85 | 60 hits | Hold to charge 0.8 s; heavy knocks down. Woodpile by the hut. **(07)** |
| `silver-sabre` | Silver Sabre | Heavy melee | 28 (heavy 60) | 0.55 | ∞ | Hold to charge 0.6 s; heavy knocks down; +50% damage to Wailers. Crane crypt. **(07)** |
| `blessed-rounds` | Blessed Rounds | Consumable | Applies Blessed Rounds | — | Single use | See Timed effects **(07)** |
| `kola-tonic` | Kola Tonic | Consumable | Applies Adrenaline | — | Single use | Crypt shelves (rare), elite drops, the merchant **(07)** |

### Firearms (07)
| Stat | Service Revolver | Double-Barrel Shotgun |
|---|---|---|
| Ammo | `revolver-cartridge` | `shotgun-shell` |
| Capacity | 6 | 2 |
| Reload | 2.4 s, all rounds at once | 2.0 s, both barrels |
| Fire interval | 0.45 s | 0.3 s |
| Hip / aimed spread | 1.5° / 0.5° | 6° / 5° |
| Effective range | 40 m | 15 m (pellets fade to 0 damage at 20 m) |
| Headshot | ×2 | ×1.5 per pellet |
| Recoil (camera kick) | 2.5° up, 0.3 s recovery | 6° up, 0.4 s recovery |
| Noise radius | 30 m | 40 m |

- **Hits** are raycasts against the zombie's capsule. The top 0.3 m of the capsule is the head.
- **Noise:** firing pulls every zombie within the noise radius toward the shot. Lurkers within 15 m of a shot wake and hunt.
- **Muzzle flash:** a short light pop and a sprite. With flashing lights off, the sprite is dimmed and the light pop is skipped.
- **Empty:** pulling the trigger with no rounds plays a dry click, with the subtitle "[click]".
- **Aiming** (right mouse) narrows the spread and the field of view by 10°, and slows walking to 70%. Right mouse still blocks with melee weapons.
- Recoil kick is gameplay, not camera shake, but it is halved when camera shake is off.

### Heavy melee and combat moves (07)
| Move | Default key | Effect | Cost | Cooldown |
|---|---|---|---|---|
| Heavy attack | Hold Left mouse (or press V to charge and release automatically) | Charged swing with the axe or sabre. Knocks the zombie down: on the ground for 1.5 s (axe) or 1.2 s (sabre), unable to attack, taking 25% more damage. | 25 stamina (axe), 20 (sabre) | — |
| Kick | Q | 5 damage, pushes the zombie 2 m back and staggers it for 0.6 s. Brutes only stagger 0.3 s and are not pushed. Father Crane ignores it. | 15 stamina | 1.2 s |
| Dodge | C | Dash 3 m over 0.25 s in the movement direction (backwards with no input), invulnerable for the first 0.2 s | 25 stamina, needs at least 25 | 0.8 s |

### Combat feedback (07)
- **Hit marker:** a small cross that flicks on the crosshair. A headshot marker adds a dot and a ring, so it is not shown by colour alone.
- **Kill feedback:** a larger marker, a dust puff from the body and the kill counted.
- **Damage numbers:** float up from the hit point and fade in 0.8 s. Body hits are pale parchment and headshots are ember with a "!" after the number. Off by the **Damage numbers** setting.

### Weapon upgrades (07)
Bought once each at the workbench while the weapon is owned. The upgrade card shows each changed stat as "old → new".

| ID | Weapon | Name | Cost | Effect |
|---|---|---|---|---|
| `up-revolver-cylinder` | Revolver | Larger Cylinder | 4 iron nails, 2 lead shot | Capacity 6 → 8 |
| `up-revolver-speedloader` | Revolver | Speed Loader | 2 cloth, 1 wood plank, 2 iron nails | Reload 2.4 → 1.4 s |
| `up-revolver-barrel` | Revolver | Rifled Barrel | 3 iron nails, 1 silver filings | Damage 34 → 44 |
| `up-shotgun-choke` | Shotgun | Choke | 3 iron nails | Spread 6° → 4° |
| `up-shotgun-belt` | Shotgun | Shell Belt | 2 cloth, 1 lead shot | Reload 2.0 → 1.3 s |
| `up-shotgun-heavy` | Shotgun | Heavy Shot | 3 lead shot, 1 black powder | Pellet damage 9 → 12 |
| `up-axe-haft` | Wood Axe | Iron-Banded Haft | 3 iron nails, 1 wood plank | Durability 60 → 100 |
| `up-axe-edge` | Wood Axe | Honed Edge | 2 iron nails, 1 bone | Damage 30 / 70 → 38 / 88 |
| `up-sabre-blessed` | Silver Sabre | Blessed Edge | 1 holy water, 1 silver filings | Damage 28 / 60 → 34 / 72 |
| `up-sabre-hilt` | Silver Sabre | Basket Hilt | 3 iron nails, 1 cloth | Heavy attack stamina 20 → 12 |

### Timed effects (07)
One shared buff system. Each active effect shows an icon with its own glyph, a countdown ring and the seconds left as text. Applying an effect that is already active refreshes its time; effects never stack. At most 6 are shown.

| ID | Name | Effect | Duration | Source |
|---|---|---|---|---|
| `blessed-rounds` | Blessed Rounds | Firearm damage ×2 | 30 s | Blessed Rounds consumable |
| `adrenaline` | Adrenaline | Movement speed ×1.3, sprint stamina drain ×0.5 | 20 s | Kola Tonic |
| `salt-circle` | Salt Circle | Zombies cannot cross the circle | 30 s | Placing a Salt Circle (shows the newest circle's time) |

---

## 5. Recipes

| ID | Inputs | Output | Unlocked |
|---|---|---|---|
| `r-bone-club` | 3 bone, 1 cloth | Bone Club | Start |
| `r-bandage` | 2 cloth | Bandage | Start |
| `r-tallow-candle` | 2 candle wax, 1 cloth | Tallow Candle | Start |
| `r-lantern-refill` | 1 lamp oil, 1 candle wax | Lantern Refill | Start |
| `r-sharpened-shovel` | Rusty Shovel, 2 iron nails | Sharpened Shovel | Survive night 1 |
| `r-holy-water-flask` | 1 holy water, 1 cloth | Holy Water Flask | Survive night 2 |
| `r-lantern-trap` | 1 lamp oil, 2 iron nails, 1 cloth | Lantern Trap | Survive night 3 |
| `r-nail-bomb` | 3 iron nails, 1 holy water, 1 lamp oil | Consecrated Nail Bomb | Survive night 4 |
| `r-salt-circle` | 2 grave salt, 1 holy water | Salt Circle | Read journal page 3 |
| `r-revolver-cartridge` | 1 black powder, 1 lead shot | 6 Revolver Cartridges | Pick up the Service Revolver **(07)** |
| `r-shotgun-shell` | 1 black powder, 2 lead shot, 1 cloth | 4 Shotgun Shells | Pick up the Double-Barrel Shotgun **(07)** |
| `r-blessed-rounds` | 1 holy water, 1 silver filings | Blessed Rounds | Survive night 2 **(07)** |

Crafting happens only at the **workbench** (keeper's hut). Crafting takes 1.5 s and the world keeps running, so crafting at night is a risk.

---

## 6. Player

| Stat | Value |
|---|---|
| Health | 100 (regenerates only via bandage or the altar) |
| Walk / sprint speed | 3.0 / 5.5 m/s |
| Stamina | 100; sprint drains 20/s, regenerates 15/s after 1 s |
| Lantern fuel | 100%; no drain by day or at dawn **(09)**, 1% per 3 s at dusk and by night |
| Lantern radius | 8 m at 100% fuel, scaling down to 2 m at 0% |
| Wall glare **(09)** | With a surface under 2 m ahead the beam dims by (distance ÷ 2 m)², never below 10%, so a wall at 0.5 m stays readable |
| Interact range | 2.5 m |

Taking damage: brief red vignette (disabled when flashing lights is off) and a heartbeat below 30 HP. From spec 06 the **health bar** shows health (see §11) and the lantern flame shows **fuel only**; the flame no longer dips on a hit.

---

## 7. Enemies

| ID | Name | HP | Speed | Damage | Behaviour | Audio signature |
|---|---|---|---|---|---|---|
| `shambler` | Shambler | 60 | 1.4 m/s | 10 | Walks straight at the player in groups. Basic wave fodder. | Wet dragging footsteps, groans |
| `lurker` | Lurker | 90 | 0 → 6 m/s lunge | 20 | Waits motionless in dark alleys and niches. Lunges when the player is within 4 m and not facing it, or when the lantern is low. **Used by the scare director.** | Silence, then a sharp breath |
| `wailer` | Wailer | 50 | 2.0 m/s | 5 | Keeps its distance. Screams every 8 s, pulling all zombies within 25 m toward the player. Priority target. | Rising wail, audible from 40 m |
| `bloater` | Bloater | 80 | 1.0 m/s | 15 | Swollen and slow. On death it swells for 0.8 s, then bursts in a cloud of grave gas: 25 damage within 3 m to the player **and** other zombies. A Bloater the burst takes to 0 HP swells and bursts in turn. Kill it at range. **(07)** | Wet gurgle; a rising hiss before it bursts |
| `brute` | Brute | 300 | 1.1 m/s | 30 | Slow and tough. Light hits and kicks only stagger it for 0.3 s and never push it. Heavy attacks and shotgun blasts from 3 m or closer knock it down. Breaks barricade boards twice as fast. **(07)** | Heavy thudding steps, a low grunt |
| `father-crane` | Father Aldous Crane | 1500 | 1.2 → 1.7 m/s | 30 / 20 | Boss, night 5 only. See *Boss*. **(07)** | Chains of a censer, and a bell that isn't there |

### Looks (07)
Follow `docs/enemy-models.md`. No new model files.
| Enemy | Model | Scale | Tint |
|---|---|---|---|
| Bloater | `zombie.glb` | x 1.35, y 1.1, z 1.35 | `#9aa58a` (sickly grey-green) |
| Brute | `zombie-brute.glb` | 1.0 | `#b5a99a` |
| Father Crane | `zombie-brute.glb` | 1.2 | `#3a3440` (black cassock), plus a built censer (sphere and chain cylinders) and stole (planes) |
| Elite (any) | its normal model | ×1.05 | ember aura plus a floating sigil ring above the head |

The Bloater burst is dust and grey-green gas particles only: no gore.

### Elites (07)
- From night 2, each Shambler, Bloater or Brute that spawns has a **6%** chance to be an elite, with at most 1 elite per wave.
- Elites have ×2 HP, ×1.15 speed and ×1.25 damage, and show the ember aura and the sigil ring (a shape cue, not only colour).
- An elite always drops one item:

| Drop | Weight |
|---|---|
| 6 revolver cartridges | 30 |
| 2 shotgun shells | 25 |
| 1 silver filings | 20 |
| 1 kola tonic | 15 |
| 2 black powder | 10 |

### Boss: Father Aldous Crane (07)
Treat him as a tragic figure who did a terrible thing, never as a joke. The rite and the church are not mocked.

- **Rising:** 10 s after the final rite starts, stone grinds beneath the altar (telegraph 1.5 s, subtitle "[stone grinding beneath the altar]"). He climbs from the catacomb stair behind the altar, or breaks through the floor beside it if the stair was never revealed.
- **Introduction:** a 3 s name card, "Father Aldous Crane" with the line "He sealed the doors". The player keeps control.
- **Health bar:** wide, top centre, with his name, phase marks at 60% and 25%, and HP as numbers.
- **The rite** keeps its progress, but it cannot complete while he lives: progress stops at 44 of 45 s until he falls.

| Phase | HP | Speed | Attacks |
|---|---|---|---|
| 1 | 100–60% | 1.2 m/s | **Censer Swing**: 1.0 s wind-up, 120° arc, 3 m, 30 damage. **Call the Congregation** every 25 s: 3 Shamblers rise from the chapel floor (1 s telegraph and a subtitle). |
| 2 | 60–25% | 1.5 m/s | Adds **The Toll** every 12 s: he raises a hand for 1.2 s (subtitle "[a great bell tolls]"), then a ring of radius 8 m around him deals 20 damage and pushes 3 m. A dodge whose invulnerable window covers the moment the ring lands avoids it. |
| 3 | under 25% | 1.7 m/s | Censer Swing twice in a row; Congregation every 18 s |

- He ignores kicks, knockdowns and salt circles block him only at half speed (he slows inside one instead of being stopped).
- **Death:** he kneels and crumbles to dust. 4 s of quiet, then the subtitle "Forgive them. Not me." The rite can be completed.
- **Rising clock:** the 10 s counts sim time from the moment the rite starts, whether or not Interact is held.

### Placements and tuning (07)
| Thing | Value |
|---|---|
| Vestry door | West chapel wall, 1.4 m wide, at (7.5, 0, 9.5). Zombies stand at (6.5, 9.5) to attack it, and at (10, −2) for the front door. A waypoint `chapel-vestry` at (5.5, 0, 9.5) links to `hut` and `grounds-south`. |
| Service Revolver | Vestry cupboard, inside the chapel at (7.9, 0.9, 7.6) |
| Double-Barrel Shotgun | Gatekeeper's lodge at the mouth of Mausoleum Row, centre (−23.8, 0, −41.5), pickup at 0.9 m |
| Wood Axe and woodpile | (−5.0, 0, 2.0), west of the hut |
| Silver Sabre | The Crane crypt's front step (−18.9, 0.35, −59.3) |
| Powder tin | Hut shelf (−1.8, 0.8, −1.0), once only; the bell tower store at (29, 0.4, −24) |
| Father Crane rises | Stair (10, 0, 10.3) if revealed, otherwise floor break (11.7, 0, 9.6) |
| Congregation | Rises at (9, 0, 3), (11, 0, 3) and (10, 0, 1.5) |
| Zombie hit capsule | Radius 0.35 m × the larger of scale x and z; height = model height × scale y; 0.5 m tall while knocked down |
| Bloater and Brute attacks | Range 1.2 m, cooldown 1.5 s. Any Brute blow cancels a reload. |
| Shotgun knockdown on a Brute | 1.5 s |
| Door attackers | Shamblers and Brutes only (Wailers keep their distance, Lurkers ambush) |
| Nailing cancels | After more than 0.05 m of travel |
| Boss swings | Aim locks when the wind-up starts; phase 3 swings are 0.3 s apart; 2.0 s cooldown after a swing |
| Kick | Uses the melee cone (70°, 1.8 m) and hits the nearest zombie in it. A kick that hits nothing still costs stamina and starts its cooldown. |
| Dodge cooldown | Counted from the start of the dash |
| Choke and aiming | The shotgun's aimed spread is never wider than its hip spread |
| Hit marker | 0.15 s, ×1.5 for a kill; 0.3 s steady with flashing lights off |
| Damage numbers | Rise at 1.2 m/s; at most 24 on screen |
| Muzzle flash | 0.06 s with a light pop; with flashing lights off 0.3 s at 35% and no light |
| Aim blend | 0.12 s |
| Blessed Rounds, Kola Tonic | Take effect at once (no use time). "Too tired" cue 1 s. |
| Effect glyphs | ✝ Blessed Rounds, ⚡ Adrenaline, ◎ Salt Circle |
| Nailing prompt | "E: Board up" with rune ᚾ |
| Extra captions | "[the axe handle splinters]", "[something worse rises]" (elite), "[heavy footsteps]" (brute), "[a gunshot]", "[a shotgun blast]", "[reloading]", "[a wet hiss]" (bloater), "[dead shuffle rising from the floor]" (congregation) |
| Audio | At most 16 voices; loops every 0.9 s (Brute step), 2.5 s (Bloater gurgle), 1.4 s (Crane's chains) |

Zombies flinch away from tallow candles for 1 s. **(09)** Darkness (lantern fuel 0) no longer cuts the damage zombies take: running dry already makes them harder to see and scares more likely.

---

## 8. Day / night cycle

| Phase | Length | What happens |
|---|---|---|
| Day | 6 min real time | Exploration and collecting. Lurkers can appear in Mausoleum Row and Catacombs. |
| Dusk | 30 s | The bell tolls (if repaired), the sky turns red, music swells, and the player should return. |
| Night | Until all waves are cleared | Waves from open graves. Fog thickens each night. |
| Dawn | 10 s | Summary card: zombies banished, items found, recipe unlocked, journal page available. From spec 08 the card also shows the night score and the upgrade choice, and dawn waits until an upgrade is picked. |

### Retrying after death (09)
In story modes the death screen offers **Retry Night** (back to the start of that dusk) and **Retry from morning** (back to the start of that day, shown when the day's start was recorded). Either way the player starts at full health with at least **60%** lantern oil; more oil is kept. Everything else is as it was at that dusk or morning. Endless Survival has neither.

### Waves
| Night | Waves | Composition per wave | Added in spec 07 | Fog density |
|---|---|---|---|---|
| 1 | 2 | 4 shamblers | — | 0.02 |
| 2 | 3 | 5 shamblers, 1 wailer (last wave) | Elites possible | 0.03 |
| 3 | 3 | 6 shamblers, 1 wailer, 1 lurker | 1 bloater (last wave) | 0.04 |
| 4 | 4 | 6 shamblers, 2 wailers, 2 lurkers | 1 bloater; 1 brute (last wave) | 0.05 |
| 5 | 5 + final rite | 8 shamblers, 2 wailers, 2 lurkers | 2 bloaters, 1 brute (last 2 waves); Father Crane during the rite | 0.06 |

**Final rite (night 5):** the player places the relics on the altar and holds *Interact* for 45 s while zombies attack the chapel. Repair stage 1 (barred doors) slows them down but doesn't stop them in this event: from spec 07, every board takes double damage during the rite, and Father Crane rises 10 s in.

---

## 9. Scare director

Scare zones are trigger volumes placed in Mausoleum Row alleys, the catacombs and two spots on the grounds. When the player enters one, the director rolls for an event:

- **Base chance** 35%, plus 25% if lantern fuel is under 30%, plus 15% at night, minus 30% within 5 m of a lit tallow candle.
- **Global cooldown** 45 s between major scares; minor scares have a 15 s cooldown.
- A zone can't repeat the same event twice in a row.

| ID | Type | Description | Telegraph |
|---|---|---|---|
| `statue-turn` | Minor | A statue is facing the player when they look back | A stone grinding sound behind the player |
| `candle-snuff` | Minor | Nearby candles go out one by one toward the player | Wind gust sound |
| `whisper-name` | Minor | Whisper from one side: "...keeper..." | Ambient sound drops out |
| `breath-behind` | Minor | Heavy breathing directly behind; nothing there when you turn | Lantern flickers |
| `door-slam` | Major | A crypt door slams shut behind the player | Creak 1 s before |
| `lurker-lunge` | Major | A Lurker bursts from a niche or side door | Silence for 1.5 s, then a breath |
| `hand-from-grave` | Major | A hand grabs at the player's ankle and slows them 50% for 2 s | Soil-crumbling sound |
| `false-quiet` | None | Nothing happens; builds dread | — |

---

## 10. Controls (all rebindable)

| Action | Default |
|---|---|
| Move | W A S D |
| Look | Mouse |
| Sprint | Shift |
| Interact / pick up / dig | E |
| Attack / throw / fire | Left mouse (hold to charge a heavy attack with the axe or sabre) **(07)** |
| Block / aim throw / aim firearm | Right mouse **(07)** |
| Heavy attack (auto charge and release) | V **(07)** |
| Reload | R **(07)** |
| Kick | Q **(07)** |
| Dodge | C **(07)** |
| Skip cutscene | Space or Enter (Esc opens pause) **(06)** |
| Hotbar slots | 1–4 |
| Satchel | Tab |
| Journal / map | J |
| Lantern on/off | F |
| Pause | Esc |

---

## 11. HUD, guidance and navigation (06)

### Health bar
A horizontal bar at the bottom left, with current and max HP as text ("72 / 100") beside it at all times, not only in the accessible HUD.

| Behaviour | Value |
|---|---|
| Size | 260 × 18 px at 1080p, dark ink frame |
| Fill | `--blood` red |
| Damage | Red fill drops at once. A pale "recent damage" chunk stays 0.15 s, then drains to the new value over 0.6 s. |
| Hit flash | The frame flashes parchment-white for 120 ms. With flashing lights off it thickens for 300 ms instead. |
| Low health | Below 30 HP the bar pulses on a 1.2 s cycle and shows a "Low" tag. With flashing lights off the frame stays thick and still and the tag stays. |
| Healing | The fill eases up to the new value over 0.4 s |

### Lantern
The flame icon shows **fuel only**: its height and brightness follow fuel, with "Oil 64%" beside it. Below 20% the label reads "Low oil" and the flame gutters (held steady when flashing lights is off).

### Objective tracker
Always visible at the top left: one main goal with a progress count, plus a smaller second line. Picked from game state by the first matching rule:

| # | When | Main line |
|---|---|---|
| 1 | Night, waves running | Survive: Wave N of M (second line: "Zombies left: K") |
| 2 | Night 5, waves cleared, rite available | Finish the rite at the altar (relics R/5) |
| 3 | Night 5, rite running, Father Crane alive | Put Father Crane to rest **(07)** |
| 4 | Dusk | Prepare for the night (second line: "Night falls in 0:24") |
| 5 | Day, journal page 1 not read | Read the page Elias left in the hut (0/1) |
| 6 | Day, no Rusted Crypt Key | Find the Rusted Crypt Key (0/1) |
| 7 | Day, no Bone Whistle | Search Mausoleum Row for the sexton's whistle (0/1) |
| 8 | Day, stair not revealed | Blow the Bone Whistle at the chapel altar |
| 9 | Day, no Iron Ossuary Key | Find the Iron Ossuary Key in the Crane crypt (0/1) |
| 10 | Day, relics under 5 | Gather the relics of the rite (R/5) |
| 11 | Otherwise | Hold out until the fifth night |

By day the second line shows "Dusk in 3:12". A tutorial prompt, when one is showing, takes the second line's place.

**Rule 12 (09):** "Craft a weapon at the workbench (0/1)" outranks rules 5–11 when it is day in a story mode, the player owns no weapon but the Rusty Shovel, and dusk is under 2:00 away. The story objective it stands above moves to the second line, and the compass points at the workbench.

### Tutorial (first day only)
One prompt at a time, in this order. Each one finishes as soon as the player does the action, and skips itself if the action was already done. Keys come from the current bindings. A **Tutorial prompts** setting (default On) turns them off.

| Step | Prompt | Done when |
|---|---|---|
| 1 | "W A S D to move, mouse to look" | Walked 3 m |
| 2 | "E to pick up the oil on the table" **(09)** | Lamp oil picked up (other pickups, page 1 included, no longer count) **(09)** |
| 3 | "E to read the page Elias left" | Journal page 1 read |
| 4 | "Hold E on a grave mound to dig (shovel in hand)" | First dig finished |
| 5 | "E at the workbench to craft" | First craft finished |
| 6 | "Tab opens the satchel; press 1–4 on an item to bind it" | Any hotbar binding changed |
| 7 | "J opens the journal and map" | Journal opened |

### Compass
A strip at the top centre spanning 180° of heading, with N / E / S / W letters and ticks every 15°.

| Marker | Glyph | Shown |
|---|---|---|
| Current objective | ◆ with the distance ("34 m") | When the objective has a place |
| Chapel | ✝ | Always |
| Keeper's hut | ⌂ | Always |
| Wave spawn direction | ☠ | Dusk and night, only once bell repair stage 3 is built |

A marker behind the player sits at the strip's nearer edge with an arrow. **(09)** While only one of the player and the objective is inside the hut, the objective marker points 1 m outside the hut door instead of through the wall, labelled "Door · 22 m" with the real distance to the objective. Each marker is a glyph and text, never colour alone.

### Map
The journal map shows the player as an arrow at their position, pointing their way, plus the objective marker.

### Zone name cards
Entering a zone shows its name for 2.5 s in IM Fell English SC, with a short line underneath. Each zone has a 30 s cooldown so walking along a boundary doesn't repeat it.

| Zone | Card | Line |
|---|---|---|
| `grounds` | Keeper's Hut and Grounds | "Crooked stones and dead oaks." |
| `mausoleum-row` | Mausoleum Row | "The great families sleep here. Not all of them." |
| `chapel` | Hollowmere Chapel | "Candle smoke and old prayers." |
| `catacombs` | The Catacombs | "They were not dead when they came down." |

### Intro cutscene
Plays once on New Game: about 35 s in-engine, five camera shots, with text cards in the keeper's hand. Space or Enter skips it, and Esc opens pause. It never plays on Continue.

| Shot | Camera | Card |
|---|---|---|
| 1 | Down the lane to the cemetery gate, in fog | "Hollowmere, October 1891." |
| 2 | Over the gate toward the hut | "The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks." |
| 3 | Past the chapel | "They need someone to tend the dead." |
| 4 | Down onto an open grave, soil thrown outward | "The graves here are opening. From the inside." |
| 5 | Into the hut, turning to the side table with page 1, where the player's view begins **(09)** | "Elias left a page on the table." **(09)** |

It ends with the first objective appearing in the tracker.

---

## 12. Progression and atmosphere (08)

### Dawn upgrades
Each dawn offers 3 different upgrades. The player picks 1, and dawn waits until they do. An upgrade at its max rank is never offered.

| ID | Name | Effect per rank | Max rank |
|---|---|---|---|
| `iron-constitution` | Iron Constitution | +15 max HP (and heals 15) | 2 |
| `steady-hands` | Steady Hands | Reload time −15% | 2 |
| `long-wick` | Long Wick | Lantern fuel drain −20% | 2 |
| `deep-pockets` | Deep Pockets | +2 satchel slots | 1 |
| `second-wind` | Second Wind | Stamina regeneration +25% | 2 |
| `gravedigger` | Gravedigger | Dig time −30% | 1 |
| `hardened-boards` | Hardened Boards | Barricade board health +25% | 1 |
| `grim-harvest` | Grim Harvest | Grave Coin drops +25% | 2 |
| `marksman` | Marksman | Headshot multiplier +0.25 | 1 |
| `blessed-reach` | Blessed Reach | Holy Water Flask radius +1 m | 1 |

### Score and combo
| Kill | Points |
|---|---|
| Shambler | 10 |
| Wailer | 25 |
| Lurker | 30 |
| Bloater | 30 |
| Brute | 75 |
| Father Crane | 1000 |
| Elite | ×2 of its type |
| Headshot kill | +5 |

- **Combo:** each kill within 4 s of the last raises the multiplier by 0.25, up to ×3.0. Four seconds without a kill resets it to ×1. Points are multiplied at the moment of the kill.
- **Night score:** kill points, plus 100 × night number for clearing the night, plus 200 if the player took no damage that night.
- **Mode multiplier** is applied to every point (see Modes).
- **End-of-run stats:** score, kills by type, accuracy (firearm shots that hit at least one zombie ÷ shots fired, as a %), melee hits, best combo, nights survived, time survived (play time with pause excluded), relics, Grave Coins earned.

### Grave Coins
| Source | Coins |
|---|---|
| Shambler | 1 (50% chance) |
| Wailer / Lurker / Bloater | 2 |
| Brute | 5 |
| Elite | +5 on top of its type |
| Contract reward | See Contracts |

Coins drop as a small pile that collects itself within 1.5 m and fades after 60 s.

### The dawn merchant
**Silas Vane, a travelling undertaker,** brings his hearse cart (built from simple meshes) to the cemetery gate each dawn: the cart stands inside the south fence at (−9, 0, 37) and Silas at (−7.2, 0, 36.2). There is no dawn before day 1, so he first comes on day 2. He stays for the first 90 s of the day, and the compass shows him while he is there. Stock is 2 fixed rows plus 3 drawn from the pool, each with a daily quantity.

| Item | Price | Daily qty | Stock |
|---|---|---|---|
| Bandage | 6 | 3 | Fixed |
| Lamp Oil | 4 | 3 | Fixed |
| 6 Revolver Cartridges | 10 | 2 | Pool (only once the revolver is owned) |
| 4 Shotgun Shells | 12 | 2 | Pool (only once the shotgun is owned) |
| Holy Water | 8 | 2 | Pool |
| Black Powder | 6 | 3 | Pool |
| Lead Shot | 5 | 3 | Pool |
| Wood Planks | 3 | 5 | Pool |
| Kola Tonic | 15 | 1 | Pool |
| Silver Filings | 20 | 1 | Pool |

### Side contracts
Each dawn deals 2 contracts that are possible right now, and the first two are dealt when the run starts, so day 1 has contracts too. A contract is never dealt if it needs a weapon the player doesn't own, if it is `c-boards-3` before the barricades exist, or if it is `c-wailer-2` when the coming night has fewer than 2 Wailers. Progress counts until the next dawn, and the reward is paid on completion with a toast.

| ID | Goal | Reward |
|---|---|---|
| `c-dig-3` | Dig 3 graves | 15 |
| `c-shotgun-5` | Kill 5 zombies with the shotgun | 20 |
| `c-revolver-head-3` | Make 3 headshot kills with the revolver | 20 |
| `c-melee-10` | Kill 10 zombies with melee weapons | 15 |
| `c-wailer-2` | Kill 2 Wailers | 20 |
| `c-boards-3` | Nail 3 barricade boards | 10 |
| `c-gather-8` | Pick up 8 materials | 10 |
| `c-unhurt` | Survive the night taking 50 damage or less | 30 |

### Modes
Chosen on New Game. Story modes play the five nights. Endless has no story.

| | Easy | Normal | Hard |
|---|---|---|---|
| Zombie HP | ×0.75 | ×1 | ×1.25 |
| Zombie damage | ×0.6 | ×1 | ×1.4 |
| Lantern drain | ×0.75 | ×1 | ×1 |
| Elite chance | 4% | 6% | 10% |
| Score multiplier | ×0.75 | ×1 | ×1.5 |

**Endless Survival:** Normal values. A 2 minute day, then night after night with no relics or rite. Retry Night is off, so death ends the run. Night `n` has `min(2 + floor(n / 2), 6)` waves of `4 + n` shamblers, `floor(n / 2)` wailers, `floor((n − 1) / 2)` lurkers, `floor((n − 2) / 2)` bloaters and `floor((n − 3) / 3)` brutes (none below zero). Zombie HP rises ×1.08 per night after night 5. The best score is saved in localStorage under `lastrites:endless-best`.

### Achievements
Saved in localStorage under `lastrites:achievements`. Unlocking shows a parchment toast. The Achievements menu on the title and pause screens lists locked ones as dim outlines with their goal text.

| ID | Name | Goal |
|---|---|---|
| `a-first-light` | First Light | Survive night 1 |
| `a-grave-robber` | Grave Robber | Dig 10 graves in one run |
| `a-marksman` | Marksman | Make 10 headshot kills in one night |
| `a-close-shave` | Close Shave | Clear a night with 10 HP or less |
| `a-combo` | Requiem | Reach a ×3.0 combo |
| `a-barricade` | Hold the Door | Nail 20 barricade boards in one run |
| `a-pages` | The Keeper's Account | Read all 5 journal pages |
| `a-relics` | Every Relic | Hold all 5 relics |
| `a-crane` | Forgive Them | Put Father Crane to rest |
| `a-rest` | Rest | Reach the Rest ending |
| `a-endless-10` | Long Night | Reach night 10 in Endless Survival |
| `a-patron` | Valued Custom | Spend 100 Grave Coins in one run |

### Reactive music
Procedural Web Audio only (no music files), on the music volume.

| Layer | When | Sound |
|---|---|---|
| 0 Calm | Day, no zombie within 30 m | Low drone, slow swell |
| 1 Unease | Dusk, or nearest zombie within 30 m | Detuned second drone and a soft pulse |
| 2 Tension | Wave running, or nearest zombie within 15 m | Faster pulse, string-like saw pad |
| 3 Danger | Nearest zombie within 6 m, or Father Crane on the field | Full layers and a heartbeat thud |

- Layers crossfade over 2 s.
- **Silence before scares:** 1.5 s before a major scare's beat, music fades to 0 over 0.3 s and stays silent until 2 s after the beat (horror-design: drop audio 1–2 s before a major scare).

### Storms
| Night | Storm chance |
|---|---|
| 1 | 0% |
| 2 | 25% |
| 3 | 40% |
| 4 | 50% |
| 5 | 100% |

A storm can also roll on a day (15%).

- **Rain:** instanced streaks around the camera, procedural rain noise, fog density +0.01, lantern drain ×1.2.
- **Lightning:** every 20–45 s, a 0.15 s cold-white light that lights the whole cemetery, then thunder 1–4 s later (procedural rumble, subtitle "[thunder]").
- **With flashing lights off,** lightning is a slow 1.5 s brightening to 30% with no flash. Thunder is unchanged.
- **Camera shake** from close thunder follows the camera-shake setting and is off at Reduced and Off scare intensity.

### Placements and tuning (08)
| Thing | Value |
|---|---|
| After the dawn pick | 2 s of dawn remain |
| Time survived | Not counted while the upgrade pick is open |
| `c-melee-10` | Melee and heavy-melee kills; kicks, thrown items and traps don't count |
| `c-gather-8` | One count per pickup |
| Father Crane | Not scaled by the mode. His kill scores nothing; `bossDefeated` scores the 1000 once |
| Elite coins | The +5 is paid even when a Shambler's 50% roll fails |
| Endless | New Game in Endless skips the intro. Fog stays at 0.06 after night 5 |
| Coin piles | Piles within 1 m merge; at most 32 (the oldest is banked, not lost); a pile shrinks in its last 2 s |
| Storms | Last from their roll to the next phase change; rain fades over 3 s; none at dusk or dawn |
| Lightning | Lights the scene by boosting the existing ambient and moon lights, so no new light. With flashing lights off: 1.5 s up to 30%, 1.5 s down |
| Close thunder | Thunder that follows its flash within 2 s |
| Rain | 600 streaks in a 36 × 20 × 36 m box around the camera |
| Music | Layers add up: calm drone; + unease; + tension (drone at 0.8); + danger. "Wave running" means a wave is active, so the gap between waves is a release. Fade back in after a scare's silence: 2 s |
| Merchant | Leaves with the subtitle "[the hearse cart rolls away]"; compass marker ⚱ "Silas"; prompt "E: Trade" with rune ᛗ |
| Seeds | One run seed chosen at New Game (1849 for old saves); every random stream derives from it, so Retry Night replays the same offers, stock and storms |
