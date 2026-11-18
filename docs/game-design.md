# Last Rites: Design Bible

Source of truth for all game content. Code in `src/data/` mirrors these tables. If they disagree, this file wins; update the code.

**Planned content.** Rows and sections tagged **(06)**, **(07)**, **(08)**, **(10)** or **(11)** belong to specs `06-clarity-and-hud`, `07-combat-and-enemies`, `08-progression-and-atmosphere`, `10-curse-stages` and `11-horror-pass` (§14). They are added to `src/data/` by that spec's data task, not before. Untagged content is already in the game.

**The 3-stage redesign (10).** On 2026-11-11 the five-night structure was replaced by three stages, each one day plus one night, each a "case" solved through puzzle minigames (§13). The detailed puzzle design lives in `docs/case-design.md`; where it and this file differ, `docs/case-design.md` wins. Until spec 10 is in the game, the code still plays the five-night structure described by the untagged numbers (night counts, wave tables, the 45 s hold rite); the **(10)** text says what replaces them. Content tagged **(10, stretch)** (E6 new enemies, E8 extra scares, E10 sanctuary health) is built only if time allows.

---

## 1. Story

### Premise
**Hollowmere Cemetery, 1891.** You arrive as the new gravekeeper. Your predecessor, **Elias Thorne**, disappeared three weeks ago, leaving only a torn journal. Each night since, graves have opened from the inside.

**(10) The curse and the three cases.** The curse holds the sun back until the dead are answered. Over **three stages** the keeper solves three cases from Hollowmere's past, each rooted in widely told graveyard history: *Saved by the Bell* (buried alive), *The Resurrection Men* (body snatching) and *The Sealed Catacombs* (Father Crane). Stage 3 also uncovers that **Silas Vane**, the dawn merchant, murdered Elias. See §13.

### The truth (revealed over five journal pages)
In the cholera winter of **1849**, parish priest **Father Aldous Crane** sealed sick but *still living* townsfolk in the catacombs beneath the chapel to "contain the pestilence". He recorded them in the parish ledger as buried, and their graves above are empty. To quiet his guilt, he began a **Rite of Rest** to lay their spirits down, but died before finishing it. Elias found the ledger, tried to complete the rite alone and failed. The unrested dead are rising, and Elias is now one of them.

### Journal pages (one unlocked per chapter)
| # | Found in | Reveals | Stage (10) |
|---|---|---|---|
| 1 | Keeper's hut (start area) | Elias notices graves "dug from the inside" and dates that don't match the ledger | 1 |
| 2 | Grounds: grave of the Marsh family | The parish ledger lists 31 burials in one week of 1849 with no death certificates | 1 |
| 3 | Mausoleum Row: Crane family crypt | Crane's confession fragment; **teaches the Salt Circle recipe** | 2 |
| 4 | Catacombs: sealed ossuary | Scratch marks, names on the walls, the five relics of the rite | 3 |
| 5 | Altar (after collecting 3+ relics) | Elias's last entry: "Finish it, whoever you are. Do not let me out." | 3 |

**(10)** Each stage's pages are readable from the stage they are mapped to; a page found early waits unread in the journal until its stage. The five pages are the story; the three case files (§13) are the puzzles.

### Endings
**(10)** The game is won by solving all three cases. The relics still matter: they are what the stage 3 rite needs, and the ending card reports them.

| Outcome | Ending |
|---|---|
| All 3 cases solved, stage 3 rite completed with all 5 relics placed in the right order | **Rest**: the rite is completed, the dead lie down, and Elias's spirit thanks you at dawn. The keeper walks out of the gates at sunrise (see Win cutscene). |
| The player dies (and does not retry) or quits the run | **Taken**: you are listed in the ledger. |

- Rest is the only winning ending. The old **Uneasy Peace** ending (3–4 relics) is retired: the rite cannot be completed with fewer than 5 relics, so a missing relic is a puzzle left unsolved, not a lesser ending.
- **Optional epilogue: Justice for Elias.** A correct Silas accusation (§13) adds a short epilogue before the walk-out: Silas's cart is found at the gate at sunrise, empty, the receipt book open on the seat, and the ledger goes to the Bishop. Without it: "Silas Vane's cart rolled away at dawn, as it always does."
- **Retry Night stays** (see "Retrying after death (09)" in §8): death never costs more than the current night.

### Win cutscene (10)
After the stage 3 sunrise, a **15–20 s skippable cutscene** plays: the keeper walks down the main path and out through the cemetery gates as the sun rises and the fog lifts. Then the ending card and run summary appear. It reuses the ending camera system. Space or Enter skips it, Esc still pauses, and with `prefers-reduced-motion` (or Camera shake off) the camera uses slow fades and steady dollies, no bob or sway. Subtitles and captions cover every sound.
- **As built (spec 10 task 6):** the 18 s walk starts at the hut door, runs south down the middle of the grounds and leaves by a gate in the middle of the south fence (z = 40, where the intro comes in). The graveyard model has no main gate there, so the cutscene stands two stone posts and a pair of iron leaves in the fence and cuts the fence and its footing out between the posts (material clipping planes, cutscene only; the playable fence never opens). The leaves swing open as the keeper nears. A sun disc rises over the south-east hills, the sky warms and the fog thins to a quarter. Captions: birdsong, footsteps, the gate, a distant bell (the only sound played for now) and the wind. Order: the Justice for Elias card when earned, the Rest sunrise, then the walk, then the ending card (title, closing line, stages cleared, cases solved) at the head of the run summary. Skipping the sunrise goes straight to the card. In the walk Space or Enter skip to the card and Esc pauses (the walk holds). Reduced motion or Camera shake off: 2.5 s fades, no bob or sway.

---

## 2. Zones

| Zone | Access | Feel | Contents |
|---|---|---|---|
| **Keeper's Hut and Grounds** | Start | Open, foggy, crooked headstones, dead oaks | Workbench, most materials, 2 relics, the chapel exterior, the woodpile with the **Wood Axe (07)** |
| **Mausoleum Row** | **Rusted Crypt Key** (**(10)** in Pell's grave once case 1 is solved; before spec 10, found on day 1 in the Marsh grave) | Narrow stone alleys, dark, echoing, statues | Scare alleys, Crane crypt (with the **Silver Sabre (07)**), the gatekeeper's lodge with the **Double-Barrel Shotgun (07)**, 1 relic |
| **Chapel** | Always (repair to make it a safe zone) | Ruined, candlelit | Altar, bell, repairs, front door and **vestry door (07)**, the vestry cupboard with the **Service Revolver (07)** |
| **Catacombs** | **Sexton's Bone Whistle** (Mausoleum Row) opens the hidden stair behind the altar | Tight tunnels, bone walls, drips, near-total dark | Ossuary, 2 relics; **Iron Ossuary Key** (on Elias's body in the Crane crypt) opens the deepest chamber |

**The chapel stair (09).** When the whistle opens the stair, the floor slabs over it vanish and the altar slides 0.6 m toward the door over 2 s with a stone grind, uncovering the steps behind it. The altar's collider is a body that slides with it, and its interaction spots move with it. The altar never lands on the player: a player standing in its way is pushed ahead of it toward the door, and a player still overlapping a chapel collider once it has settled (or in a game loaded with the stair open) is moved to the nearest free spot in the nave. After the slide a 0.35 m capsule can walk round either side of the altar (0.9 m or more clear) to the opening behind it, which is entered from the sides. The stair leads to the catacombs: the player walks about three steps down (feet below y -0.5), the screen fades to black over 0.6 s, a caption reads "[footsteps descend into the dark]", the player is put in the catacomb corridor 1.5 m past its gate (world x 25, z 41.5, facing +z) and the screen fades back in over 0.8 s. Input is held only while the screen is fully black (0.5 s). The zone, music and guidance follow the new position. The corridor's gate on the grounds stays the way back out; there is no matching climb back up, since walking out of the gate is the return. Once the stair is open, the compass and objective marker for a goal inside the catacombs point at the chapel stair until the player is down. A save, Continue or Retry whose position lies inside the stair shaft restores the player to the corridor arrival point instead. The end wall collider stays where the vault comes down. Father Crane climbs from this stair during the stage 3 rite.

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
| Who attacks the doors | At night, every zombie whose target (the player) is inside the chapel. Also 1 in 3 zombies of each wave (rounded down, minimum 1 from night 2; **(10)** minimum 1 from the fourth wave of stage 1) heads for the nearest door instead of the player. |
| Damage to boards | The zombie's normal hit damage per blow. Brutes deal double. During the final rite all boards take double damage. **(10)** The waves of a night never end, so boards are repaired between waves. |
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
`grave-coin`, **Grave Coins**: a counter, not a satchel slot. Dropped by zombies and spent at the dawn merchant. **(11)** Also spent at the hut's vending machine, by day or night (§14.6).

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
| `brisk-draught` | Brisk Draught | Consumable | Applies Brisk Draught | — | Single use | The hut's vending machine only (§14.6) **(11)** |

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
| `brisk-draught` | Brisk Draught | Movement speed ×1.25 | 60 s | Brisk Draught **(11)**. With Adrenaline active the larger speed multiplier applies, not the product |

---

## 5. Recipes

| ID | Inputs | Output | Unlocked |
|---|---|---|---|
| `r-bone-club` | 3 bone, 1 cloth | Bone Club | Start |
| `r-bandage` | 2 cloth | Bandage | Start |
| `r-tallow-candle` | 2 candle wax, 1 cloth | Tallow Candle | Start |
| `r-lantern-refill` | 1 lamp oil, 1 candle wax | Lantern Refill | Start |
| `r-sharpened-shovel` | Rusty Shovel, 2 iron nails | Sharpened Shovel | Survive night 1 **(10)** Stage 1 dawn (start of stage 2) |
| `r-holy-water-flask` | 1 holy water, 1 cloth | Holy Water Flask | Survive night 2 **(10)** Stage 1 dawn |
| `r-lantern-trap` | 1 lamp oil, 2 iron nails, 1 cloth | Lantern Trap | Survive night 3 **(10)** Stage 1 dawn |
| `r-nail-bomb` | 3 iron nails, 1 holy water, 1 lamp oil | Consecrated Nail Bomb | Survive night 4 **(10)** Stage 2 dawn (start of stage 3) |
| `r-salt-circle` | 2 grave salt, 1 holy water | Salt Circle | Read journal page 3 |
| `r-revolver-cartridge` | 1 black powder, 1 lead shot | 6 Revolver Cartridges | Pick up the Service Revolver **(07)** |
| `r-shotgun-shell` | 1 black powder, 2 lead shot, 1 cloth | 4 Shotgun Shells | Pick up the Double-Barrel Shotgun **(07)** |
| `r-blessed-rounds` | 1 holy water, 1 silver filings | Blessed Rounds | Survive night 2 **(07)** **(10)** Stage 2 dawn |

Crafting happens only at the **workbench** (keeper's hut). Crafting takes 1.5 s and the world keeps running, so crafting at night is a risk.

### Where to look (09, task 11m)
An undiscovered recipe stays "???" but says where its missing ingredients come from. The places come from the data only (the "Found" column of §3 made concrete): loot tables and spawn points, fixed spawns, the merchant's stock and the elite drop table.
- Each missing ingredient reads "??? · dug from grave mounds, found in coffins" (the ingredient stays unnamed until held). At most two places, nearest to the player first. Places: dug from grave mounds, found in coffins, on the hut shelf, on crypt shelves, at the chapel font, in the catacomb walls, by the oak path, sold by Silas at dawn, dropped by elite zombies.
- Unknown-recipe tooltip: "??? Needs 2 ingredients. You have: Cloth. Still to find: something dug from grave mounds or found in coffins."
- A known recipe with a shortfall shows "Found: …" under the count ("Cloth 1/2, need 1 more").
- **Mark on map** (button, or M on a focused row) pins the nearest source of the first missing ingredient that still has it today (graves not yet dug, shelves and coffins not yet looted, fixed spawns not yet taken). The merchant and elite drops have no fixed place and are never pinned. With nothing left the row says "None left today. Try again tomorrow".
- The powder tin and woodpile loot tables of §3 are not placed in the world yet, so they are not listed as sources.
- Bench stock: each pile on the workbench top is the item's Blender model (ember glow stays, as emissive only), and a missing ingredient in the recipe ghost is the item's silhouette in flat dark material.

### Tiered crafting (10, planned and cuttable: E4)
If built, recipes are grouped in three tiers tied to the stage that unlocks them, and damage and cost both rise with tier (a property test checks it). Cut order: see §13.
| Tier | Stage | Rule | Weapons |
|---|---|---|---|
| 1 | 1 | 2–4 common materials | Bone Club, Bandage, Tallow Candle, Lantern Refill |
| 2 | 2 | Needs a crafted **component** first (for example an Iron Head from nails and a plank) plus 5–7 materials | Sharpened Shovel, Holy Water Flask, Lantern Trap |
| 3 | 3 | Needs a **blueprint** pieced together from 2 clues plus a rare material (silver filings, grave salt) | Silver Sabre upgrades, Nail Bomb, Blessed Rounds |

The recipe book shows the tier and any missing component. If E4 is cut, the flat recipes above stand, unlocked at the stage dawns shown in the table.

- **As built (spec 10 task 10):** tiers apply in the Story modes (Easy, Normal, Hard, Short Vigil). Endless keeps the flat recipes above and has no component recipes. Tier 1 is the flat recipes unchanged (the start four, the Salt Circle and the two ammunition recipes). Tiered inputs:

| Recipe | Tier | Inputs with tiers on |
|---|---|---|
| `r-iron-head` (component) | 2 | 2 iron nails, 1 wood plank |
| `r-oil-wick` (component) | 2 | 1 cloth, 1 candle wax, 1 lamp oil |
| `r-sharpened-shovel` | 2 | Iron Head, 2 iron nails, 1 wood plank, 2 cloth, plus the Rusty Shovel |
| `r-holy-water-flask` | 2 | Oil Wick, 2 holy water, 2 cloth, 1 candle wax |
| `r-lantern-trap` | 2 | Oil Wick, 2 lamp oil, 3 iron nails, 1 cloth |
| `r-nail-bomb` | 3 | Iron Head, 3 iron nails, 1 holy water, 1 lamp oil, 1 grave salt; blueprint "Bomb plan" (clues `hearse-pin-hasp` and `oil-other-crypt`) |
| `r-blessed-rounds` | 3 | 2 holy water, 2 silver filings, 2 black powder, 2 lead shot; blueprint "Blessing rite" (clues `old-bishops-seal` and `hymn-letters-below`) |

  The component recipes unlock with Tier 2 at the Stage 1 dawn. A blueprint is held once both its clues are found and is never used up. Recipes that need a component are not hidden as "???" by it, since components are crafted, never found. The book groups the unlocked recipes under "Tier N · Stage N" headings, tags each one, and lists "Needs component: Iron Head (craft it first)" and "Blueprint: Bomb plan, 1/2 clues found" under the ingredients. A missing component reads "Craft it first" instead of a place, and Mark on map skips it. The Silver Sabre upgrades stay on the Upgrades tab and are not tiered. Property 23 checks that, with tiers on, the weakest weapon and the cheapest recipe (components counted as their materials) both rise from tier to tier.

---

## 6. Player

| Stat | Value |
|---|---|
| Health | 100 (regenerates only via bandage or the altar) |
| Walk / sprint speed | 3.0 / 5.5 m/s |
| Stamina | 100; sprint drains 20/s, regenerates 15/s after 1 s. **(10)** Max stamina 100 / 90 / 80 by stage 1 / 2 / 3, and sprint drain ×0.8 on Easy, ×1 on Normal, ×1.2 on Hard. The stamina bar shows the cap. The cap never rises between stages, and stamina never exceeds it. A cap that shrinks mid-run lowers current stamina to the cap. Endless Survival uses 100 and ×1. |
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
| `lurker` | Lurker | 90 | 0 → 6 m/s lunge | 20 | Waits motionless in dark alleys and niches. Lunges when the player is within 4 m and not facing it, or when the lantern is low. **Used by the scare director.** **(10)** Never present by day: from spec 10 there are no zombies of any kind during the day, so Lurkers appear only at dusk and night. | Silence, then a sharp breath |
| `wailer` | Wailer | 50 | 2.0 m/s | 5 | Keeps its distance. Screams every 8 s, pulling all zombies within 25 m toward the player. Priority target. | Rising wail, audible from 40 m |
| `bloater` | Bloater | 80 | 1.0 m/s | 15 | Swollen and slow. On death it swells for 0.8 s, then bursts in a cloud of grave gas: 25 damage within 3 m to the player **and** other zombies. A Bloater the burst takes to 0 HP swells and bursts in turn. Kill it at range. **(07)** | Wet gurgle; a rising hiss before it bursts |
| `brute` | Brute | 300 | 1.1 m/s | 30 | Slow and tough. Light hits and kicks only stagger it for 0.3 s and never push it. Heavy attacks and shotgun blasts from 3 m or closer knock it down. Breaks barricade boards twice as fast. **(07)** | Heavy thudding steps, a low grunt |
| `father-crane` | Father Aldous Crane | 1500 | 1.2 → 1.7 m/s | 30 / 20 | Boss, stage 3 only (**(10)** formerly night 5). See *Boss*. **(07)** | Chains of a censer, and a bell that isn't there |
| `crawler` | Pale Crawler | 35 | 1.2 m/s crawl, 6 m/s lunge for 0.6 s | 8 | Hides under grave mounds and broken coffins from the stage 2 night; bursts out within 2 m and grabs. A level swing passes over it. See §14.2. **(11)** | A soil shiver and a wet click |
| `bride` | Hollow Bride | 60 | 2.2 m/s | 0 (drains 20 oil) | A haunting from stage 2, at most one at a time, never in waves or elites; seen only in the lantern cone or within 3 m. See §14.2. **(11)** | A cold breath and faint humming |
| `hound` | Corpse Hound | 45 | 5.5 m/s | 10 | Packs of 2 to 3 from stage 2 circle at 4 to 6 m and dart in one at a time. A gunshot or flare scatters them. See §14.2. **(11)** | A growl from the dark |

### Looks (07)
Follow `docs/enemy-models.md`. No new model files.
| Enemy | Model | Scale | Tint |
|---|---|---|---|
| Bloater | `zombie.glb` | x 1.35, y 1.1, z 1.35 | `#9aa58a` (sickly grey-green) |
| Brute | `zombie-brute.glb` | 1.0 | `#b5a99a` |
| Father Crane | `zombie-brute.glb` | 1.2 | `#3a3440` (black cassock), plus a built censer (sphere and chain cylinders) and stole (planes) |
| Elite (any) | its normal model | ×1.05 | ember aura plus a floating sigil ring above the head |

The Bloater burst is dust and grey-green gas particles only: no gore.

### New enemies (10, stretch: E6)
Built only if time allows, after the cases. They reuse existing models with new tints and effects (no new model files), use synth audio, appear in the elite rules and the dev panel, and every sound has a subtitle.
| ID | Name | From | Behaviour |
|---|---|---|---|
| `sprinter` | Sprinter | Stage 1 | Fast zombie that pauses, then dashes 8 m in a straight line. Telegraph: a short shriek and a lunge pose 0.6 s before. Can be dodged. |
| `spitter` | Spitter | Stage 2 | Keeps 8–12 m away and lobs a grave-bile projectile with a visible arc: 15 damage plus a 2 s slow. Dodged, or blocked by cover. |
| `wraith` | Wraith | Stage 2, night only | A ghost that floats through walls and gravestones, immune to normal weapons. Hurt only by holy water, Blessed Rounds, or by holding the lantern beam on it for 2 s, which makes it solid. Drains lantern oil when close. |
| `grave-witch` | Grave Witch | Stage 3, one per night | Stands still and chants (audible from 40 m, directional). Every 10 s she either curses the player (screen darkens and controls feel sluggish for 4 s) or raises 2 Shamblers. Killing her ends both effects. |

The curse's screen darkening obeys Flashing lights (a slow fade, no pulse).

### Elites (07)
- From night 2 (**(10)** from wave 4 of stage 1), each Shambler, Bloater or Brute that spawns has a **6%** chance to be an elite, with at most 1 elite per wave.
- Elites have ×2 HP, ×1.15 speed and ×1.25 damage, and show the ember aura and the sigil ring (a shape cue, not only colour).
- An elite always drops one item:

| Drop | Weight |
|---|---|
| 6 revolver cartridges | 30 |
| 2 shotgun shells | 25 |
| 1 silver filings | 20 |
| 1 kola tonic | 15 |
| 2 black powder | 10 |

- **Ownership rule:** ammo drops only for a gun the player owns. A gun is owned when it is in the satchel or the combat state already tracks its magazine. While the revolver is not owned the cartridge row drops 2 lead shot instead, and while the shotgun is not owned the shell row drops 1 black powder instead. Weights stay the same, so the table still sums to 100.
- **Weapon wear:** when a melee weapon has 5 hits left it shows the toast and subtitle "<weapon name> is cracking" with a crack sound, once per weapon. When it breaks, the hotbar switches to the next melee weapon (Rusty Shovel, Bone Club, Sharpened Shovel, Wood Axe, Silver Sabre), or the next filled slot if there is none.

### Boss: Father Aldous Crane (07)
Treat him as a tragic figure who did a terrible thing, never as a joke. The rite and the church are not mocked.

- **(10) In the 3-stage design** the "final rite" is the stage 3 **rite**: placing the five relics on the altar in the order from Crane's confession and Elias's notes (§13), which replaces the 45 s Interact hold. The 10 s rising clock below starts when the player places the first relic. Placing the relics in the wrong order does not end anything: the relic returns to the satchel, the altar rings a wrong note (subtitle "[a sour note from the altar]") and the answer-lock rules of §13 apply. The rite **cannot complete while Father Crane lives**; the placed relics wait until he falls. The old "44 of 45 s" stop is the same rule for the old hold.
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
| Double-Barrel Shotgun | Gatekeeper's lodge at the mouth of Mausoleum Row, just inside the grounds fence, centre (−23.8, 0, −36.5), pickup at 0.9 m **(10)** |
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
| Day | 6 min real time | Exploration, collecting, crafting, and the case's day minigames (§13). **(10)** No zombies anywhere by day, Lurkers included. A day lasts 6 min in Story, 2 min in Endless and in Short Vigil. |
| Dusk | 30 s | The bell tolls (if repaired), the sky turns red, music swells, and the player should return. |
| Night | Until all waves are cleared | Waves from open graves. Fog thickens each night. **(10)** Until the stage's case is answered correctly at the altar: the curse holds back the sun, waves never end, and each wave is harder than the last (see Waves). The night has no clock. |
| Dawn | 10 s | **(10)** One dawn screen: the sunrise shot (3 s), then one panel with the summary on the left and the 3 upgrade choices on the right, then a "Visit the merchant" button (hidden when the player has no coins). Summary card: zombies banished, items found, recipe unlocked, journal page available. From spec 08 the card also shows the night score and the upgrade choice, and dawn waits until an upgrade is picked. |

### Retrying after death (09)
In story modes the death screen offers **Retry Night** (back to the start of that dusk) and **Retry from morning** (back to the start of that day, shown when the day's start was recorded). Either way the player starts at full health with at least **60%** lantern oil; more oil is kept. Everything else is as it was at that dusk or morning. Endless Survival has neither. **(09, F5)** A Retry never un-finds anything: clues, journal pages and the recipes those pages taught stay found, as do solved minigames and case-board links.

### Saving, Continue and quitting (09, B16 and F5)
- The game **autosaves at every dawn and at the start of each dusk**, into its own slot (`lastrites:autosave`). The altar save keeps its own slot and is never overwritten by an autosave.
- **Continue** on the title screen shows when either slot holds a valid save, and loads the newer one (the altar save on a tie).
- **Quit to Title** (pause menu and death screen) asks "Quit to Title?" first. The safe choice, Stay, has focus; Esc cancels; both buttons are keyboard-reachable with visible focus.

### Waves
| Night | Waves | Composition per wave | Added in spec 07 | Fog density |
|---|---|---|---|---|
| 1 | 2 | 4 shamblers | — | 0.02 |
| 2 | 3 | 5 shamblers, 1 wailer (last wave) | Elites possible | 0.03 |
| 3 | 3 | 6 shamblers, 1 wailer, 1 lurker | 1 bloater (last wave) | 0.04 |
| 4 | 4 | 6 shamblers, 2 wailers, 2 lurkers | 1 bloater; 1 brute (last wave) | 0.05 |
| 5 | 5 + final rite | 8 shamblers, 2 wailers, 2 lurkers | 2 bloaters, 1 brute (last 2 waves); Father Crane during the rite | 0.06 |

**Final rite (night 5):** the player places the relics on the altar and holds *Interact* for 45 s while zombies attack the chapel. Repair stage 1 (barred doors) slows them down but doesn't stop them in this event: from spec 07, every board takes double damage during the rite, and Father Crane rises 10 s in.

### Waves in the 3-stage design (10)
The five fixed nights above become **endless escalating nights**, one per stage. The old rows are kept as the *difficulty ladder*: each wave of a night draws its composition from a row of the table, and the row only goes up.

| Stage | Ladder rows used | Fog | Notes |
|---|---|---|---|
| 1 | Rows 1 then 2 (nights 1–2): waves 1–3 use row 1, wave 4 onward row 2 | 0.02 → 0.03 | Elites possible from wave 4 |
| 2 | Rows 3 then 4 (nights 3–4): waves 1–3 use row 3, wave 4 onward row 4 | 0.04 → 0.05 | Bloaters and Brutes enter as the rows say |
| 3 | Row 5 for every wave; the **rite** replaces the "final rite" hold | 0.06 | Father Crane rises when the rite's relic placement starts (see Boss) |

- **Escalation:** once a night passes its last ladder row, each further wave adds 1 shambler, and every 3rd further wave adds 1 wailer or lurker (alternating), so a wave is never smaller than the one before. Difficulty never decreases within a night.
- **Alive cap:** at most 12 / 16 / 20 zombies alive at once (stage 1 / 2 / 3). Waves wait for room. A zombie stuck out of reach for 20 s is despawned and the wave counts it as banished. "Stuck" means a chasing zombie more than 4 m from the player that has stayed within 1 m of one spot.
- **Pace:** the next wave begins 20 s after the previous wave's last zombie falls, or 60 s after the previous wave began, whichever is first (the bell tolls 20 s before each wave if rung). The gap is the release in the tension curve.
- **Curse:** the night ends only when the stage's case is answered correctly (§13). A correct answer stops spawning, living zombies collapse to dust and the sunrise plays. A wrong answer spawns a wave at once and locks the altar for 30 s (never ends the run).
- **Retry Night** returns to the start of that stage's dusk. The case's solved minigames and clue links are kept.
- Fog thickens by stage, not by wave. Endless Survival keeps its own formula (§12).
- **(11)** Corpse Hounds join the ladder rows from stage 2, and Pale Crawlers may be added as extras, by raising row sizes only, so a wave is never smaller than the one before and the alive caps hold. The Hollow Bride is never in a wave. Each tuning change is logged (§14.2).

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

### Scare director in the 3-stage design (10)
- **No Lurkers by day.** By day there are no zombies, so `lurker-lunge` rolls only at dusk and night; a day roll for it becomes `door-slam` instead. Every other scare stays valid by day.
- The "+15% at night" term applies per stage as before. Base chance, the lantern term, the candle term and all cooldowns are unchanged: 45 s between major scares, 15 s between minor ones.
- **The first scare** stays the mild statue turn within the first 3 minutes. **The first minigame** must be reachable within 3 minutes too: stage 1's Ledger Cross-check starts from the hut shelf.
- **Wrong day answers** add Doubt (§13), never a scare.
- **No scare fires** during any minigame overlay, the satchel, the journal at day, crafting or pause. At night the journal does not pause, but no scare begins while it is open.

### Screen jumpscares (11)
Full-screen faces (§14.1) are major scares with their own 180 s cooldown on top of the 45 s major-scare gap. They are earned (a Pale Crawler's burst, the Hollow Bride's touch and three scripted moments), never rolled by the director, and follow the separate Jumpscares setting; Scare intensity still governs the events above.

### Extra scares (10, stretch: E8)
Each has a telegraph and a subtitle, keeps the cooldown rules, and is added to the scare-accessibility hook's checks.
| ID | Type | Description | Subtitle |
|---|---|---|---|
| `coffin-scratch` | Minor | Scratching under the player's feet | "[scratching beneath the soil]" |
| `wrong-bell` | Minor | A distant church bell tolls the wrong number of times | "[a bell tolls, wrongly]" |
| `child-hum` | Minor | A child humming from an empty grave | "[a child humming]" |
| `witch-laugh` | Minor | A witch's laugh circling the player | "[laughter circling]" |
| `crypt-knock` | Minor | Knocking from inside a crypt door | "[knocking from inside]" |
| `ghost-slide` | Major | A ghost slides across the edge of the screen in the lantern beam | "[something pale slides past]" |
| `own-name` | Minor | The keeper's own name whispered | "[a whisper of your name]" |

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
| Big map (pins) | M **(09)** |
| Minimap on/off | N **(09)** (moved from M) |
| Pause | Esc |

The Move, Sprint and Heavy attack keys are also shown on the **Controls hint panel** (§11), read live from these bindings, so a rebound key shows correctly. Key names are written readably: "Shift", "Mouse 2", "Space", "Ctrl".

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

### Controls hint panel (09)
A small parchment-on-dark panel at the bottom left, in the same column as the health bar and oil gauge and **above** them, so it never overlaps them. One line per action, each a key cap plus a word. Data in `src/data/controlHints.ts`, rules in `src/game/systems/controlHints.ts`.

| Line | Shows | Clears when |
|---|---|---|
| Move | W A S D Move (keys from the four movement bindings) | The player has moved about 10 m |
| Sprint | Shift Sprint | The player has sprinted for 2 s |
| Charge | "Hold V Charge a heavy swing". **Only while a weapon that can charge is in hand** (Wood Axe, Silver Sabre); left out with any other weapon, since V does nothing then | One charged heavy swing is released |

- **When:** from the end of the intro. A used line fades out over 0.6 s (a steady linear fade, so it suits Flashing lights off too); a line that merely stops applying (axe put away) goes at once. When every line is gone the panel is gone. The charge line returns whenever an axe or sabre is equipped until a heavy swing has been made.
- **Setting:** **Show control hints** (Settings, default On, saved with the others) hides the whole panel. Turning it back on shows every line again.
- **Hidden** in menus (pause, journal, satchel, merchant, altar panel, mode select), the workbench view, the big map, examine, cutscenes and endings.
- **Saved:** the used lines are saved with the run (next to the tutorial steps). Continue restores them, so the panel does not come back unless the setting is turned back on. New Game clears them. Retry Night and Retry from morning leave them alone, like the tutorial.
- **With the tutorial:** tutorial step 1 ("W A S D to move, mouse to look") stays in the objective tracker's second line. The panel is the permanent reminder and the tutorial is the first-day prompt; both clear on their own actions and neither blocks the other.
- **Fit:** lines wrap inside the panel (at most 22 rem or 40% of the width). Checked at 800x600 with the body font and with **Plain font for journal** on (spec 09 task 20; the panel always uses the body font, so the setting does not change its size).

### Journal reading text and the plain font (09, B14)
The keeper's handwriting (Homemade Apple) is hard to read at small sizes, so journal page text, examine page and clue text and the contract text are larger (journal 1.25 rem, line height 2.2; examine page 1.3 rem; examine clue 1.15 rem; contracts 1.2 rem). The setting **Plain font for journal** (Settings, default Off, saved with the others) shows that reading text in the body font (IM Fell English) instead. Headings, the map and other UI are unchanged. It is keyboard-operable like the other toggles.
- **Stamina caption:** the stamina bar carries a small "Stamina" caption above it, so the Sprint line's meaning is clear.

### Objective tracker
Always visible at the top left: one main goal with a progress count, plus a smaller second line. Picked from game state by the first matching rule:

| # | When | Main line |
|---|---|---|
| 1 | Night, waves running | Survive: Wave N of M (second line: "Zombies left: K"). **(10)** Replaced in stages: "The curse holds. Solve the case at the altar." with the Curse meter (below) on the second line |
| 2 | Night 5, waves cleared, rite available | Finish the rite at the altar (relics R/5). **(10)** Stage 3: "Place the relics in the right order" (relics R/5), shown once minigames 3a and 3b are solved |
| 3 | Night 5, rite running, Father Crane alive | Put Father Crane to rest **(07)**. **(10)** Stage 3 only |
| 4 | Dusk | Prepare for the night (second line: "Night falls in 0:24") |
| 5 | Day, journal page 1 not read | Read the page Elias left in the hut (0/1) |
| 6 | Day, no Rusted Crypt Key | Find the Rusted Crypt Key (0/1) |
| 7 | Day, no Bone Whistle | Search Mausoleum Row for the sexton's whistle (0/1) |
| 8 | Day, stair not revealed | Blow the Bone Whistle at the chapel altar |
| 9 | Day, no Iron Ossuary Key | Find the Iron Ossuary Key in the Crane crypt (0/1) |
| 10 | Day, relics under 5 | Gather the relics of the rite (R/5) |
| 11 | Otherwise | Hold out until the fifth night. **(10)** "Solve the case: <stage title>" with N/M clues found |

### Objective tracker in the 3-stage design (10)
- **Rules 5–10 per stage** (by day): the first unsolved day minigame or missing key of the current case, from §13. Stage 1: "Cross-check the ledger against the stones (0/1)", then "Examine the three bells (0/3)". Stage 2: "Open the sexton's crest lock (0/1)", "Put the watch log in order (0/1)", "Compare the boot prints (0/1)". Stage 3: "Set the hymn tiles at the altar (0/1)", "Reconstruct Elias's last night (0/1)", "Gather the relics of the rite (R/5)". Rule 11 is "Solve the case: <title>, clues N/M".
- **Night, rule 1 (10):** "The curse holds. Solve the case at the altar." The second line shows the **Curse meter** instead of "Zombies left" (endless waves have no count). The meter falls each time a correct clue link is made on the case board, and the night ends when the case is solved. The meter is a number plus a bar ("Curse 7 / 10"), never colour alone.
- **Altar locked:** while the 30 s lock runs, the second line reads "The altar is silent: 0:24".
- **Compass:** the objective marker points to the next minigame's place by day and to the altar at night. The merchant marker ⚱ "Silas" is unchanged.

### Hints, help and guidance (10)
- **Keeper's hunch (E11):** if no new clue has been found for 2 minutes of play by day, the lantern flame leans toward the nearest unfound clue. It is a lean in shape, not a flash, and obeys head bob and reduced motion.
- **Dawn card:** shows "Clues found N/M" for the next case.
- **Short Vigil (E11):** a Story option with 3 stages and 2-minute days, so a full run fits in about 15 minutes for judges. Minigame rules, hints and the case are unchanged; only the day length is.
- **As built (spec 10 task 7):** the flame that leans is the lantern flame on the HUD oil gauge (the lantern itself is only light, with no flame in view). It skews about its base toward the clue's bearing (up to 22°), fully to one side when the clue is behind; the clock counts day play only and restarts on any new clue. The clues it points at are the stage's walk clues not yet picked up and the station of each unsolved minigame (the bells one by one). The dawn card's first line is "Clues found (next case): N/M". Short Vigil sits between Hard and Endless on the difficulty screen with Normal's modifiers. The Case-tab tutorial step was already step 8.
- **Tutorial (10):** tutorial step 7 is followed on the first day by step 8, "Open the Case tab in the journal to pin clues together", done when the Case tab has been opened.

By day the second line shows "Dusk in 3:12". A tutorial prompt, when one is showing, takes the second line's place.

**Rule 12 (09):** "Craft a weapon at the workbench (0/1)" outranks rules 5–11 when it is day in a story mode, the player owns no weapon but the Rusty Shovel, and dusk is under 2:00 away. The story objective it stands above moves to the second line, and the compass points at the workbench.

### Hints that fit where you are (09, task 11o)
A hint that names a key and an object only makes sense within reach. Tutorial steps that point at a place (2 oil on the table, 3 the page Elias left, 5 the workbench) have two texts in `src/data/tutorialSteps.ts`: the **near** text (key and action) and a **far** text that says where to go ("Go to the hut: there is oil on the table"). The near text shows within **6 m** of the object **and** in the same building (hut, chapel and catacombs each count as different from the open grounds, so one metre outside the hut door is far). Once near it stays near until the player is past **8 m** or in another building, so the line never flickers on the edge. Steps with no single place (walk, dig, satchel, journal) are unchanged. The rule is the pure `hintNear` in `systems/objectiveHint.ts`; the objective rules' main lines (5-10) already say where to go and keep their text and the dusk countdown.

### Clue and interact outline (09, task 11o)
The highlight around an interactable is an **inverted hull**: the object's own meshes drawn again slightly larger as flat, unlit pale back faces behind it, sized from the meshes' bounds (thickness 5% of the largest side, 3 to 6 cm). It follows whichever model the object shows. No box, no wireframe, no light. It shows on hover; clue spots also fade it in within **4 m** (over the last metre) while examining would do something, and fade it out after the clue is examined. The fade is steady, never a pulse, so it suits Flashing lights off and reduced motion.

### Clue reveal and the Clues tab (09, task 11q)
A found clue shows as a **clue reveal**, not a toast: its picture (the clue model, rendered by `tools/blender/clue_icons.py`; headstone, plaque and case clues have none and show no placeholder), its title (the spot's label, or a short title in `src/data/clueReveal.ts`), its text, and "Noted in your journal (J)" with the player's key. It sits centred a little below the crosshair: its top edge at 58% of the height but never above the interaction prompt (50% + 92 px), picture beside the words, at most 640 px wide. On screens under 640 px tall or 900 px wide it shrinks and keeps to the middle band, clear of the controls panel and the hotbar. It fades in over 0.5 s with a 6 px rise and a slight blur that sharpens (a plain fade with reduced motion), holds 3.5 s plus 45 ms a character (at most 10 s), and fades out over 1.2 s. It never takes focus. Clues found close together play one after another; a clue found while a menu, the journal, a minigame, examine or a cutscene is open waits until it closes, and is dropped after 30 s (it is already in the journal). Each reveal plays the page turn with the caption "[quill scratches]". It fires where a clue is really found (the mystery store, and case clues found outside a minigame; a minigame and the merchant's receipt announce their own clues), so Continue and Retry never replay it. The ledger refusal uses the same place and fade with no picture, title or journal line. The Clues tab lists clues in the order found, each with its 48 px picture and title; clues found since the tab was last read have a red ink dot, and the tab reads "Clues ·N" until it is opened. The read count is saved (`mystery.cluesRead`; older saves count everything as read). Rules: `systems/clueReveal.ts`.

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

**Label overlap rule (09):** two labels never draw over each other. Labels are laid out in priority order (objective, chapel, hut, pins, merchant, skulls) with their real measured widths (mark image, glyph and text) plus a 6 px gap. A label that clashes with the bottom row drops to a second row above it; if that row is also taken it slides sideways to the nearest free spot. Only the spawn skulls are dropped when both rows are full, because the nearer ones already show that direction. This covers the objective distance over "Hut", Chapel and Hut sharing a bearing, and the pin labels. The layout is the pure function `layoutCompassLabels` in `systems/compassLayout.ts`.

### HUD layout and small screens (09, task 18)
The HUD fits without any two blocks overlapping at 1920x1080, 1280x720 and 800x600 (browser test `e2e/hud-800x600.spec.ts`, by day and at night with the boss bar, door status and effect icons showing).

| Place | Blocks |
|---|---|
| Top left | Objective tracker (with the Curse meter), kept beside the compass |
| Top centre | Compass, then one column under it: wave tally, rite meter, Father Crane's bar, door status. Each takes only its own height, so the boss bar sits just under the compass. |
| Top right | Score, then the minimap (96 to 168 px, by screen height) |
| Bottom left | Controls hint panel, health bar, oil gauge |
| Bottom centre | Stamina bar with its caption |
| Bottom right | Effect icons above the hotbar |

**Under 900 px wide:** the compass, the top-centre column and the boss bar are 50% of the screen width (60% above 900 px). The objective tracker takes the rest of the left quarter, with its main line at 16 px, and the Curse meter's bar wraps under its number. The stamina bar narrows to 120 px, and the hotbar slots to 62 px, so the hotbar stays clear of the stamina bar.

### Map
The journal map shows the player as an arrow at their position, pointing their way, plus the objective marker.

### Big map and pins (09)
**M opens the big map**, a full-screen overlay in the Journal map's pencil style. It shows explored cells, landmarks, the player arrow, the objective and the pins. Esc or M closes it. It frees the cursor through the shared cursor-release hook. It pauses the game by day like the journal. At night, dusk and dawn it keeps the world running (the screen dims, sound goes on), the F8 rule of spec 10.

| Input | Effect |
|---|---|
| Wheel | Zoom, from the whole grounds down to about 30 m across |
| Drag | Pan |
| Left-click on ground | Place a pin (anywhere inside the playable bounds; unexplored ground shows a "?") |
| Left-click on a landmark | Pin the landmark and name the pin after it |
| Click or right-click on a pin | Remove it |
| Arrow keys, Enter, Delete | Move a cursor, place a pin, remove the pin under the cursor (or the selected one) |
| 1, 2, 3 | Select a pin; the cursor jumps to it |
| + / − | Zoom |

**Pins:** up to 3, numbered 1–3 with distinct shapes (circle, square, triangle), never colour alone. A 4th pin replaces the oldest and takes its number. A small legend lists each pin with its name and distance, and has "Clear all". Pins also show:
- **Compass:** one marker per pin, "① 23 m", with the pin's number glyph; off-range pins sit at the strip's edge with an arrow like the objective.
- **Minimap:** drawn on it; off-map pins are pinned to its border with a chevron.
- **Journal Map tab:** shown and editable (click to place, click a pin to remove).
- **World:** a faint upright pencil-line beacon at each pin, emissive only, no light, no flashing, visible through fog, fading out within 4 m. The setting **Show pins in the world** (default On) controls it.
- **Reaching a pin:** walking within 2 m clears it, with a soft sound and the caption "[pin reached]".
- **Saving:** pins are saved with the run and restored on Continue and both Retry options; New Game clears them.

### Zone name cards
Entering a zone shows its name for 2.5 s in IM Fell English SC, with a short line underneath. Each zone has a 30 s cooldown so walking along a boundary doesn't repeat it.

| Zone | Card | Line |
|---|---|---|
| `grounds` | Keeper's Hut and Grounds | "Crooked stones and dead oaks." |
| `mausoleum-row` | Mausoleum Row | "The great families sleep here. Not all of them." |
| `chapel` | Hollowmere Chapel | "Candle smoke and old prayers." |
| `catacombs` | The Catacombs | "They were not dead when they came down." |

### Intro cutscene
Plays once on New Game: about 20 s in-engine **(09, B15)** (was about 35 s), five camera shots, the fog flyover and the hut card kept, with text cards in the keeper's hand. Space or Enter skips it, and Esc opens pause. It never plays on Continue.

| Shot | Camera | Card |
|---|---|---|
| 1 | Down the lane to the cemetery gate, in fog | "Hollowmere, October 1891." |
| 2 | Over the gate toward the hut | "The parish wrote: the keeper, Elias Thorne, has not been seen in three weeks." |
| 3 | Past the chapel | "They need someone to tend the dead." |
| 4 | Down onto an open grave, soil thrown outward | "The graves here are opening. From the inside." |
| 5 | Into the hut, turning to the side table with page 1, where the player's view begins **(09)** | "Elias left a page on the table." **(09)** |

It ends with the first objective appearing in the tracker.

---

### Info dots and the Creatures page (11)
- A small circled **i** next to each journal section heading and the main HUD panels shows a short how-to-play tooltip; the setting "Show info dots" (on) hides them all (§14.5).
- The journal gets a **Creatures** page (the bestiary): each creature once seen shows its sketch, a field note and "What works"; unseen creatures stay hidden (§14.2).

## 12. Progression and atmosphere (08)

### Dawn upgrades
Each dawn offers 3 different upgrades. **(10)** There are two dawns in a story run (after stages 1 and 2), then the win. The player picks 1, and dawn waits until they do. An upgrade at its max rank is never offered.

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
- **Night score:** kill points, plus 100 × night number for clearing the night, plus 200 if the player took no damage that night. **(10)** "Night number" is the stage number, and "clearing the night" is solving the case. Case bonuses: Sharp Eye +300 (§13); each Doubt costs 50.
- **Mode multiplier** is applied to every point (see Modes).
- **End-of-run stats:** score, kills by type, accuracy (firearm shots that hit at least one zombie ÷ shots fired, as a %), melee hits, best combo, nights survived (**(10)** stages and cases solved), time survived (play time with pause excluded), relics, Grave Coins earned.

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
**Silas Vane, a travelling undertaker,** brings his hearse cart (built from simple meshes) to the cemetery gate each dawn: the cart stands inside the south fence at (−9, 0, 37) and Silas at (−7.2, 0, 36.2). There is no dawn before day 1, so he first comes on day 2 (**(10)** the start of stage 2). **(10)** He trades at every dawn until the stage 3 reveal, and the case leaves the economy untouched. With the player's first purchase in stage 1 he hands over a **Vane & Sons receipt**, a key clue for case 3 (§13). He stays for the first 90 s of the day, and the compass shows him while he is there. Stock is 2 fixed rows plus 3 drawn from the pool, each with a daily quantity.

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
Each dawn (**(10)** two in a story run) deals 2 contracts that are possible right now, and the first two are dealt when the run starts, so day 1 has contracts too. A contract is never dealt if it needs a weapon the player doesn't own, if it is `c-boards-3` before the barricades exist, or if it is `c-wailer-2` when the coming night has fewer than 2 Wailers. Progress counts until the next dawn, and the reward is paid on completion with a toast.

| ID | Goal | Reward |
|---|---|---|
| `c-dig-3` | Dig 3 graves | 15 |
| `c-shotgun-5` | Kill 5 zombies with the shotgun | 20 |
| `c-revolver-head-3` | Make 3 headshot kills with the revolver | 20 |
| `c-melee-10` | Kill 10 zombies with melee weapons | 15 |
| `c-wailer-2` | Kill 2 Wailers | 20 |
| `c-boards-3` | Nail 3 barricade boards | 10 |
| `c-gather-8` | Pick up 8 materials | 10 |
| `c-unhurt` | Survive the night taking 50 damage or less (**(10)** until the stage's case is solved) | 30 |

### Modes
Chosen on New Game. Story modes play the five nights (**(10)** the three stages). Endless has no story and **skips the cases**; its wave formula, 2 minute day and best-score key are unchanged.

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
| `a-first-light` | First Light | Survive night 1 (**(10)** solve case 1) |
| `a-grave-robber` | Grave Robber | Dig 10 graves in one run |
| `a-marksman` | Marksman | Make 10 headshot kills in one night |
| `a-close-shave` | Close Shave | Clear a night with 10 HP or less (**(10)** solve a case with 10 HP or less) |
| `a-combo` | Requiem | Reach a ×3.0 combo |
| `a-barricade` | Hold the Door | Nail 20 barricade boards in one run |
| `a-pages` | The Keeper's Account | Read all 5 journal pages |
| `a-relics` | Every Relic | Hold all 5 relics |
| `a-crane` | Forgive Them | Put Father Crane to rest |
| `a-rest` | Rest | Reach the Rest ending |
| `a-endless-10` | Long Night | Reach night 10 in Endless Survival |
| `a-patron` | Valued Custom | Spend 100 Grave Coins in one run |
| `a-case-closed` | Case Closed **(10)** | Solve all 3 cases without using a hint |
| `a-justice` | Justice for Elias **(10)** | Give the correct Silas Vane accusation in stage 3 |

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

**(10)** By stage: stage 1 night 15%, stage 2 night 40%, stage 3 night 100% (stages 1, 2 and 3 stand for the old nights 1–2, 3–4 and 5; the numbers sit slightly under the old averages because a storm now lasts the whole endless night). Rolled once at dusk. No major scare is placed within 2 s after a lightning flash.

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

### Rendering and the Low graphics setting (09, task 11n-a)
- **Look:** AgX tone mapping, low-intensity ambient occlusion (N8AO), bloom only on emissive parts (threshold 1), vignette and a subtle grain. The lantern and the moon cast shadows; the moon's shadow box is 28 m wide around the player with soft PCF. Inside the chapel the fog is 2.4× denser and warmer (`src/data/interiorFog.ts`), eased over about 0.4 s at the door.
- **Low graphics** (Settings, default Off, saved with the others) turns off the ambient occlusion and the moon's shadows, the two effects that add draw calls. Everything else stays.
- **Chapel bell:** the belfry bell swings up to 7° and dies away over 7 s each time the bell rings (dusk bell and wave bell).

---

## 13. Stages and cases (10)

Detailed puzzle design: `docs/case-design.md`. If it and this section differ, it wins.

### Structure
- **3 stages,** each one day plus one night. Cases: stage 1 *Saved by the Bell*, stage 2 *The Resurrection Men*, stage 3 *The Sealed Catacombs*.
- **Day:** no zombies anywhere. The player explores, gathers, crafts and plays the case's **day minigames**. Each solved minigame gives a key clue or opens a place.
- **Night:** the curse holds back the sun. Waves never end and escalate every wave (§8) until the player gives the case's **final answer at the chapel altar**. The answer can be prepared by day but can only be *given* at the altar.
- **Correct answer:** waves stop, living zombies collapse to dust, the sunrise plays, then the dawn screen (§8). The next case's clues replace the old set.
- **Wrong answer:** a wave spawns at once and the altar locks for **30 s**. It never ends the run. After **2 wrong answers** on the same case, **one more clue link** must be made on the case board before the next try (stops brute-forcing a multiple-choice answer).
- **Win:** all 3 cases solved, then the Win cutscene (§1). Endless Survival skips the cases.
- **Dev mode:** "skip to stage N" and "solve current case" go through the real stores (see `structure.md`).

### Case board (journal tab "Case")
A cork board, styled as the most polished screen in the game (the Costume Contest judges UI).
- **Clue cards:** each clue is a pinned card (title, one line, small icon). Cards appear when found; nothing is auto-solved.
- **Red string:** drag a string between two cards, or by keyboard: select a card, then the other, then Enter. A pair that belongs together shows a short deduction note, e.g. "Same hand as the ledger". These notes are the steps to the answer. A wrong pair costs nothing and gives no note: its string is thin and dashed with a square ✗ tag, a right pair's is thick and solid with a round ✓ tag (shape, not colour).
- **Final question:** a sentence with slots at the bottom, e.g. "The one buried alive lies in ___ because ___." It can be filled by day and answered only at the altar.
- **The journal at night:** by day it pauses the game. At night (and dusk and dawn) it does **not** pause: the screen dims, the sounds go on and the page says "The world is still moving". Esc opens the pause menu over it at night. No scare begins while it is open. The big map follows the same rule.
- **Altar panel:** the altar (E, "Open") shows the final question's slots, the wrong-answer count, the lock countdown ("The altar is silent: 0:24") and the link-needed message. By day it only explains that the curse does not stir.
- **Hints:** three tiers per case, each costing Grave Coins: (1) which cards matter, (2) the rule to apply, (3) the answer. Prices: 5 / 10 / 20 coins. In Story modes (all difficulties), tier 3 is free once the night has run 3 minutes, so no judge gets stuck. Using any hint forfeits Sharp Eye and Case Closed.
- **Doubt:** a wrong answer in a **day** minigame adds one extra shambler to that night's first wave (at most +3 a night) and costs 50 score.
- **Sharp Eye:** solving a case with no hint and no wrong answer (day or altar) gives +300 score.
- **Closed cases tab:** a solved case moves there, with a 3–5 sentence "what really happened" page on the real history behind the legend (safety coffins, body snatching and mortsafes, the church's role in the catacombs). The page is educational, non-gory and respectful.
- Hints and Doubt do not apply in Endless Survival (no cases).
- **Curse meter:** each correct clue link lowers it (default 10 steps per case; every link the case designer marks as a deduction counts). It is a number and a bar.

### Case 1: "Saved by the Bell" (buried alive), stage 1
Safety coffins had a bell on a rope so someone wrongly buried could signal.
- **Minigame 1a, Ledger Cross-check (hut and grounds):** the hut shelf holds the parish ledger page, 8 entries with date, plot, cause and doctor. The player reads the readable stones (Marsh, Hale, Ames, Pell, plus 2 new ones) and opens a two-page spread, ledger left and rubbings right. They draw lines from stone to ledger line and flag mismatches (date, plot, missing certificate). Three right flags narrow the case to **3 candidate graves**.
- **Minigame 1b, The Bells (the 3 candidate graves):** each has a safety-bell post, with an examine view (turn the bell, inspect the rope, read the tag). One rope is cut clean (a knife, not rot); one bell is rusted solid (it never rang); one tag carries the hurried certificate's date, a day *before* the ledger says the person died.
- **Red herrings:** fresh flowers on Hale (a widow still visits) and a toppled Marsh stone (frost heave).
- **Final answer:** "The one buried alive lies in **Pell's grave** because **the bell rope was cut and the certificate was signed before the death**."
- **Reward:** sunrise; Pell's grave then holds the **Rusted Crypt Key** (the dig mound marks once solved), and the Mausoleum Row gate opens for stage 2. The tutorial and journal page 1 remain the first-day entry points.

### Case 2: "The Resurrection Men" (body snatchers), stage 2
Graves were robbed for anatomy schools; iron mortsafes and watch-houses were built against it. **Suspects:** the sexton, the doctor, the lodge keeper, the gravedigger.
- **Minigame 2a, The Crest Lock (Mausoleum Row):** the sexton's niche at (−21.2, −52.5) has four dials of family crests (the new rune and mark images). A note in the gatekeeper's lodge reads "Turn them in the order the founders were laid down"; the years are on the 6 crypt name tablets. Solving it gives the **Sexton's Bone Whistle** and the sexton's ledger of night watches.
- **Minigame 2b, The Watch Log (the lodge):** the watch-house logbook's entries are torn out and scattered. The player puts 8 entries in time order. This reveals a **2-hour gap** on the night the Ames grave was robbed, and whose watch it was.
- **Minigame 2c, Boot Prints (the Ames grave):** compare 3 plaster casts of prints at the grave with the 4 suspects' boots (examine views): tread, size, hobnail pattern. One matches.
- **Other clues:** a surgeon's receipt for "subjects" (Mausoleum Row); a spade with fresh clay (gravedigger's shed, a **red herring**: he dug a legal grave that day); a doctor's anatomy school letter (a **red herring**: he bought legally, with a licence).
- **Final answer (red-thread accusation):** "The bodies were sold by **the lodge keeper**. Motive: the surgeon's receipt in his hand. Means: the matching boots. Opportunity: the gap on his watch."
- **Reward:** sunrise; the whistle and the hidden stair lead into stage 3.
- **As built (spec 10 task 5):**
  - **Crest Lock (2a):** six crypt name tablets hang on the avenue railing in front of their crypts (family, crest, "laid down" year; reading one says it aloud). Ashby (moon) 1767, Whitlock (cross) 1803, Marlowe (tower) 1752, Penrose (swords) 1811, Kestrel (star) 1761, Thorne (leaf) 1758. The dials carry the four founders' crests (moon, tower, star, leaf); the answer is tower, leaf, star, moon. The overlay shows the lodge note and the tablets as read. A wrong setting never says which dial is wrong. Solving reveals the whistle in the niche (a reward spawn at (−20.7, 0.3, −52.5), `revealedBy: '2a'`) and pins the sexton's watch ledger.
  - **Watch Log (2b):** eight torn pages on the lodge table, the night of 9 November 1849, hours in words (nine to first light). The gap is one to three, on the lodge keeper's watch; the solved log marks it ⌛ and names him. The pages start in a fixed scrambled order.
  - **Boot Prints (2c):** a smudged heel (too worn to match), a full print (cross-cut, size 11, a ring of nine hobnails with one missing at the heel) and a narrow town print. The gravedigger's boots differ from the lodge keeper's only in a full ring of ten, so the hobnails decide it. A wrong pair names the first feature that disagrees.
  - **Walk clues:** the surgeon's receipt lies on the lodge table, the spade at (−4, 8) and the school letter in the avenue. Walk clues of stages 1 and 2 are props by day until found (stage 3's positions are still to be checked).

### Case 3: "The Sealed Catacombs" (Father Crane), stage 3, with the Silas reveal
The existing story stands: Crane sealed 31 living people in the catacombs in 1849.
- **Minigame 3a, The Hymn Board (chapel):** the board reads 4 · 19 · 2 · 41 · 23. The vestry psalter's index lists hymns 1–60 by title. Crane's confession fragment says "What I hid, I hid beneath the Word." The first letters of those hymns spell **BELOW**. The player sets five brass letter tiles on the altar and blows the whistle, and the hidden stair opens.
- **Minigame 3b, Elias's Last Night (Crane crypt):** six evidence cards go on a midnight-to-dawn timeline: (1) the dry boots in the hut, (2) Elias's unsent letter to the Bishop, hidden in the hut bench, (3) hearse-cart ruts at the Row gate, (4) lantern oil spilled at the crypt step, (5) fingernail marks inside the crypt door, (6) an iron hearse-pin still in the door's outer hasp. The right order replays his night in captioned beats and shows he was **sealed in alive**. Pulling the pin opens the crypt: Elias's body and the **Iron Ossuary Key**.
- **Stage 3 at night:** the hymn board, the psalter, the evidence props and the slate stay usable at night, and the board opens the stair at night too (with the whistle held). The story night only ends with the rite, and the rite needs the heart below the stair and the ossuary key from 3b, so a player who is not done by dusk must not be stuck (spec 10 task 12.2). **(10)**
- **The Silas reveal:** the ledger's "same careful hand" is **Josiah Vane's**, the 1849 parish undertaker, paid for 31 funerals that never happened (his name is on a ledger flyleaf in the ossuary). **Silas Vane**, his son and the dawn merchant, gave the player a **Vane & Sons receipt** with their first purchase in stage 1; the handwriting matches. Elias's letter names "the undertaker's family". Silas trades as normal at every dawn before this.
- **Final answers at the altar (stage 3, waves running; Father Crane rises at the first):**
  1. **The rite:** place the 5 relics in the order given by Crane's confession and Elias's notes (relic placement on the altar, replacing "hold E for 45 s"). A correct order lifts the curse and the run is won. Treat it seriously (taboos).
  2. **The accusation (optional, does not affect the win):** "Elias was sealed in by **Silas Vane**. Motive: the handwriting. Means: the hearse-pin. Opportunity: the cart ruts." A right answer adds the epilogue (§1) and the achievement *Justice for Elias*. A wrong answer or none: "Silas Vane's cart rolled away at dawn, as it always does." A wrong accusation does not lock the altar and spawns no wave.
- **Red herrings:** at least 2 per case (e.g. the oil spilled at a different crypt, an old bishop's seal).

### Rules for every minigame
- Each is its own overlay, using the shared cursor-release hook from spec 09 task 11h, with no timer by day, and works fully by keyboard.
- The text is real text: the plain-font setting is honoured, colour is never the only signal, and every sound has a caption.
- Answers live in data (`src/data/cases.ts`); rules are pure functions (`src/game/systems/case*.ts`).
- New props (bell posts, plaster casts, letter tiles, hymn board, hasp pin, name tablets) are simple meshes. They must clear the gameplay anchors and waypoint edges and add no lights. The crypt name tablets go on the tablet faces the scene already has on each crypt front.
- Every answer must follow from the in-game clues alone, with 6–8 clues per case.
- Property tests cover: wrong answers rejected and right accepted; hint tiers reveal in order; Doubt capped; clue sets swap per stage; state rebuilds on Continue and resets on New Game and Retry; every answer's clues are reachable in that stage.

### Name the Dead (10, cuttable)
A night puzzle inside the fight, stages 2 and 3: during waves, one opening grave per wave glows faintly and shows a name. If the name is in the case evidence, holding Interact for 3 s there speaks it and **seals the grave** for that wave (+100 score). Taking damage breaks the hold. An unknown name shows "You don't know who lies here."
- **As built (spec 10 task 11):** Story modes only. Each wave of a Stage 2 or 3 night lights one of the eight wave graves, picked from the run seed, the stage and the wave (Retry Night lights the same graves). An ember light, a dark slab and a floating label with the ᛞ rune and the name mark it. The names are in `DEAD_NAMES` in `data/cases.ts`: Esther Ames, John Pell, Tobias Hale and Marsh from Stage 2 on, and Elias Thorne in Stage 3, plus two strangers (Hester Lowe, Ezra Crane) whom no evidence names. A name is known once any clue naming it is found, in any case. The prompt reads "Hold E: Name the dead". A ring with "Naming John Pell… hold E" and the seconds shows during the hold. Letting go or opening a menu restarts it, and a hit ends it ("Struck. The name is lost.") until E is let go. On a seal the caption reads "[a name, spoken: John Pell]" (a low hum and a whisper), a toast says the grave is sealed for this wave, and the score rises by 100. No zombie rises from a sealed grave until the next wave, which lights another grave.

### Grab kill-cam (10, E7)
When a Brute, Lurker or Sprinter reaches the player while they are below 25% health, or out of stamina and not facing it, the camera is pulled to face the zombie for 1.2 s (close-up, stinger, shake), then the player breaks free with damage. A lethal hit plays the full close-up before the death screen, and a scare can never be the sole cause of death (taboo: no cheap deaths). At most once every 60 s. Non-gory (silhouette, sound, dust only).
| Scare intensity | Effect |
|---|---|
| Full | The full version |
| Reduced | Shorter, quieter stinger, no shake |
| Off | No camera pull; a red edge flash and the subtitle "[something seizes you]" only |
| Flashing lights off | No flash (a steady edge instead) |

- **As built (spec 10 task 8):** only the Brute and the Lurker grab (there is no Sprinter in the game). "Facing" is within 60° of straight ahead. The blow is the zombie's own hit, held back until release, so the kill-cam itself never adds damage. Reduced holds 0.7 s with a quieter stinger. Reduced motion keeps the turn but drops the lean-in, zoom and shake. The keeper is released facing the zombie. A red edge shows at every intensity (pulsing, or steady with Flashing lights off), with the subtitle "[something seizes you]"; at Off the subtitle shows even with Subtitles off. Dodging, god mode and an already-held keeper are never seized.

### Sanctuary health (10, stretch: E10)
The chapel gets an overall health bar on top of its door boards: zombies that break in damage the altar area. At 0 the stage restarts from dusk under the Retry Night rules. The bar shows on the HUD only at night and only after the doors have been barred, as a number and a bar.

### Build order and cuts (deadline Dec 4, feature freeze Nov 26)
Build: E1 stage loop, the case board, stage 1 (1a, 1b), stage 3 (3a, 3b, rite, Silas), stage 2 (2a, 2b, 2c), E5 win cutscene, E11 help and Short Vigil, E7 kill-cam, E9 stamina, E4 tiered crafting, Name the Dead.
Cut in this order if time runs short: Name the Dead, E4, minigame 2c, minigame 2a (keep the whistle where it is now), E9. Do not cut the case board, stages 1 and 3, the rite, E1 or E5. E6, E8 and E10 are stretch only.

---

## 14. Horror pass (11)
Spec `11-horror-pass` calls this section "§12". It is numbered 14 here because §12 (progression) and §13 (stages and cases) were already taken and specs 08 and 10 cite them by number. Every table row below is mirrored in `src/data/` with the same values (the file named in each subsection); if the two differ, this section wins. Rows tagged **(11)** are added by spec 11's tasks, not before. Feature freeze is 2026-11-26; §14.9 says what is cut, in which order.

### Waiting list and placeholders (11)
- Claude makes the art (models, rigs, clips, face images, the lantern cookie) in Blender at the fixed paths in `src/data/assets.ts`. Every expected art file of this spec is a row in `src/data/placeholders.ts` (path, kind, owner, feature, use).
- Where a file is missing, the game uses a **placeholder**: the zombie model scaled and tinted (creatures), a labelled flat rectangle (face images), a plain bottle primitive named "Brisk Draught (placeholder)" (item), a plain cabinet with the real colliders and handle anchors (vending machine), a small dark ellipsoid (bats), a generated soft round texture (cookie), procedural Web Audio (sounds), and today's weapon-only viewmodel (hands). A placeholder is never final art.
- Each placeholder use carries a `// PLACEHOLDER: <path>` comment and is registered once in the **Waiting_List** when its load fails. In dev (`?dev=1`) a placeholder shows a small "PLACEHOLDER" label.
- The game builds, passes its tests and starts with every art file absent. The last task of spec 11 lists every file still waiting, with its full path.
- New models are Draco or meshopt compressed; the sum of `public/assets` stays under 25 MB.

### 14.1 Screen jumpscares (11, H1)
A face slams onto the screen at an earned moment: a zombie face up from the bottom edge, a ghost down from the top. Data: `src/data/screenScares.ts`; rules: `src/game/systems/screenScares.ts`; overlay: `ScreenScare`, above the HUD.

| Face | Set | Edge | Path |
|---|---|---|---|
| `face-zombie-1` | zombie-bottom | Bottom | `public/assets/scares/face-zombie-1.webp` |
| `face-zombie-2` | zombie-bottom | Bottom | `public/assets/scares/face-zombie-2.webp` |
| `face-crawler` | zombie-bottom | Bottom | `public/assets/scares/face-crawler.webp` |
| `ghost-bride-1` | ghost-top | Top | `public/assets/scares/ghost-bride-1.webp` |
| `ghost-bride-2` | ghost-top | Top | `public/assets/scares/ghost-bride-2.webp` |

Faces are transparent `.webp`, 2048 px tall, under 300 KB. A pick is random within the set and never the same face twice in a row.

| Timing | Value |
|---|---|
| Image height | 85% of the viewport height |
| In | 70 ms, no easing |
| Hold | 550 to 800 ms (random) |
| Out | 250 ms, slides off its edge and fades to 0 |
| Telegraph lead | 500 to 1500 ms (a flicker, creak, breath or music drop first) |
| Cooldown | 180 s of sim time between screen scares |
| Major-scare gap | 45 s after any major scare (§9) |
| World dim | 30% brightness for the hold |
| Scale jitter | 1.00 to 1.04 |
| Duck | other audio −70% for the hold, back within 250 ms |
| Off subtitle | 3 s |

| Trigger | Set | When | Gameplay effect |
|---|---|---|---|
| `crawler` | zombie-bottom | A Pale Crawler bursts within 1.5 m in front | Grab damage after the out phase starts |
| `bride` | ghost-top | The Hollow Bride reaches the player | Oil drain after the in phase ends |
| `coffin-night-2` | zombie-bottom | Opening the marked broken coffin, stage 2 night | Once per save |
| `hut-window-night-3` | zombie-bottom | Looking out of the hut's west window, stage 3 night | Once per save; the face presses against the glass |
| `ossuary-grille` | ghost-top | Looking through the ossuary door's grille the first time | Once per save |

- A trigger inside the cooldown is skipped: no face, the moment stays unused, and its gameplay effect applies at once.
- While any overlay is open (menus, pause, journal, satchel, workbench, big map, examine, cutscenes, endings), a scare is held back and no cooldown starts.
- A screen scare never takes health. The sting is three layers: a sharp attack, a low thud, and a scream or wail.
- Pause stops the overlay's timers and its sound.

| Jumpscares | Face | Flash (1 frame) | Shake | Chromatic split | Dim | Sting | Subtitle |
|---|---|---|---|---|---|---|---|
| Full | Yes | Yes | Yes | Yes | Yes | 100% | For the whole scare |
| Reduced | Yes | No | No | No | No | 50% | For the whole scare |
| Off | No | No | No | No | No | None | 3 s, describing the event |

With Flashing lights off there is never a flash or chromatic split; with Camera shake off (or reduced motion without shake turned on) there is never shake. The gameplay effect is the same at every setting.

### 14.2 New creatures (11, H2)
Data: `src/data/enemies.ts` (`EnemyId`, `ENEMY_MAP`, `ENEMY_LOOKS`) and `src/data/creatures.ts`. Each creature warns before it attacks, and every tell and attack sound has a caption and plays from the creature's position.

| ID | Name | HP | Speed | Damage | From | Waves | Elites |
|---|---|---|---|---|---|---|---|
| `crawler` | Pale Crawler | 35 | 1.2 m/s crawl; 6 m/s lunge for 0.6 s | 8 (grab) | Stage 2 night | Optional extras; mostly placed at spots | May be |
| `bride` | Hollow Bride | 60 | 2.2 m/s drift | 0 (drains oil) | Stage 2 | Never | Never |
| `hound` | Corpse Hound | 45 | 5.5 m/s | 10 (dart) | Stage 2 | Yes | May be |

| Trait | Value |
|---|---|
| Crawler spots per stage 2 night | 3 to 6, distinct grave mounds or broken coffins |
| Crawler burst range | 2 m |
| Crawler face range | 1.5 m, in front |
| Crawler grab cooldown | 1.5 s per crawler |
| Crawler weakness | Horizontal melee misses (0 damage); downward swings, guns and lantern-trap fire hit normally |
| Bride visible | Inside the lantern cone, or within 3 m |
| Bride oil drain | 20 points of the 0 to 100 fuel scale, never below 0 |
| Bride return | 30 to 60 s after she vanishes |
| Bride alive | At most 1 |
| Bride passes | Fences, gravestones |
| Bride blocked by | Chapel walls, hut walls, salt circles |
| Bride damage | Lead (revolver, shotgun) 0, with a no-effect cue; holy water, silver sabre, Blessed Rounds normal |
| Bride lantern | Within 8 m: flame bends, light ×0.7 (a fade of at least 1 s with Flashing lights off) |
| Hound pack | 2 to 3 |
| Hound circle | 4 to 6 m |
| Hound darts | One at a time, at least 2 s apart |
| Hound scatter | A lantern flare or gunshot within 15 m scatters the pack for 4 s, with no damage |
| Seen (bestiary) | In the lantern cone or within 10 m, once |
| Scripted floor | A creature or scripted event never takes the player below 1 HP if they were above 1 HP when it began |

| Creature | Tell (0.5 to 1.5 s before damage) | Caption |
|---|---|---|
| `crawler` | A soil shiver and a wet click | [soil shivers, a wet click] |
| `bride` | A cold breath, the lantern flame bends, faint humming | [a cold breath, faint humming] |
| `hound` | A growl from the dark | [a growl from the dark] |

| Bestiary | Field note (at most 200 characters) | What works |
|---|---|---|
| `crawler` | It waits under mounds and broken coffins and drags itself out when you pass. Its body is too low for a level swing. | Swing down, shoot it, or burn it with a lantern trap. |
| `bride` | A drifting bride seen only in your lantern's light. She cannot wound you, but her touch drinks your oil. | Holy water, the silver sabre, Blessed Rounds; she cannot cross salt. Lead passes through. |
| `hound` | They hunt in twos and threes, circling out of reach until one darts in. | A gunshot or a lantern flare scatters them; guns and heavy swings bring them down. |

Unseen creatures show no name and no sketch. Tuning changes to the wave tables are logged in `docs/kiro-log.md`; a wave is never smaller than the one before and the alive caps (12 / 16 / 20) hold.
- **As built (spec 11 task 7):** wave extras live in `WAVE_EXTRAS` (`src/data/waves.ts`), added on top of the older columns. Hounds per wave: row 3 waves 1 to 3: 0, 0, 2; row 4 waves 1 to 4: 2, 2, 3, 3 plus 1 crawler in the last wave; row 5 waves 1 to 5: 0, 0, 3, 3, 3 plus 1 crawler in each of the last 2 waves. Rows 1 and 2 are unchanged. Wave strength weights: crawler 2, hound 3. The final-rite assault wave grows from 15 to 19. Largest composition: stage 2 has 16 (the cap), stage 3 has 19 (cap 20). An emerged crawler sinks back after 25 s and a hound pack leaves after 45 s (`CREATURE_LIFETIME_S`), so unkillable leftovers never hold the alive cap. Coin drops: crawler 1 coin at 50%, hound 2 coins always. A downward swing is any heavy swing (`melee-down`); a light swing is `melee-horizontal` and passes over a crawler.

### 14.3 Zombie looks (11, H3)
| Contract | Value |
|---|---|
| Models | `public/assets/models/enemies/zombie.glb`, `zombie-brute.glb`, `crawler.glb`, `bride.glb`, `hound.glb`, paths only in `src/data/assets.ts` |
| Clips | Idle, Walk, Run, Crawl, Attack, Lunge, Threaten, HitReact, Death; the hound (`Gallop`) and the Bride (`Glide`) use their own movement clip in place of Crawl |
| Missing clip | Idle, with one warning per model and clip |
| Missing model | Base `zombie.glb` |
| Variants | `look-0` to `look-3`, one shown at a time, picked from the spawn uid (FNV-1a hash, mod 4) |
| Missing variant | Base mesh only |
| Tint | Only where a variant defines one; otherwise the file's materials |
| Budget | One skinned mesh, under 15,000 triangles |
| Looks per new id | 4 (`crawler`, `bride`, `hound` in `ENEMY_LOOKS`) |

The style is original survival horror: grey-green mottled skin with exposed tendons, torn 1891 burial clothes, cloudy eyes, broken teeth, a shambling gait.

### 14.4 Bats (11, H4)
Data: `src/data/bats.ts`; rules: `src/game/systems/bats.ts`, `batPerches.ts`. Models `props/bat-perched.glb` and `props/bat-flying.glb`.

| Bats | Value |
|---|---|
| Perched per night | 8 to 12, from stage 1; one per box (fewer if fewer boxes qualify, with no error) |
| Perch boxes | Top face of `graveyard-colliders.json` boxes 0.6 to 1.6 m tall |
| Watch range | 14 m: `head` and `eyes` turn on Y toward the player |
| Turn limit | 120° either side of rest |
| Ease time constant | 0.4 s (back to rest within 2 s) |
| Take-off | Player within 3 m, or a gunshot within 10 m |
| Flaps | 8 per second, `wing-left` and `wing-right` pivots |
| Flight | 6 s on a curved path away from the player, then fades out in 1 s or less |
| Return | 120 s after removal, to a different free box |
| Chitter | At most one per 20 s while a bat is perched; caption at least 2 s |
| Eyes | Emissive, steady with Flashing lights off; no light |
| Belfry flock (optional) | 15 to 20 instanced bats at the dusk bell, gone within 10 s; skipped when frames average over 22 ms; no shake |

Bats never hurt the player and never start a screen scare.

### 14.5 Info dots (11, H5)
A small circled **i** next to each journal section heading and each HUD panel below shows a parchment tooltip on how to play (not the story), at most 2 sentences, written from what the code does. Data: `src/data/infoTips.ts`.

| Key | Where |
|---|---|
| `journal-pages` | Journal: Pages |
| `journal-clues` | Journal: Clues |
| `journal-case` | Journal: Case |
| `journal-closed` | Journal: Closed cases |
| `journal-relics` | Journal: Relics |
| `journal-contracts` | Journal: Contracts |
| `journal-map` | Journal: Map |
| `journal-creatures` | Journal: Creatures (with H2) |
| `hud-case-board` | Case board |
| `hud-clues` | Clues |
| `hud-curse` | Curse meter |
| `hud-hints` | Hints (5, then 10, then 20 coins) |
| `hud-map` | Map |
| `hud-recipes` | Recipes |
| `hud-satchel` | Satchel |
| `hud-relics` | Relics |
| `hud-oil` | Lantern oil |
| `hud-stamina` | Stamina |
| `hud-bestiary` | Bestiary |
| `hud-coins` | Coins (mentions the vending machine) |

- Hover, Tab focus or a tap opens the tooltip within 100 ms; leaving, blur or a tap outside closes it within 100 ms.
- Escape closes an open tooltip and does not pause; with no tooltip open, Escape pauses as before.
- The dot links to its tooltip with `aria-describedby` and has a visible focus state. At 800x600 with the plain font, a tooltip stays fully on screen and clear of the health bar, oil gauge and controls hint panel.
- A journal tab added later needs a tip, or the tip test fails.

### 14.6 Vending machine (11, H6)
The "Hollowmere Automatic Dispenser": `props/vending-machine.glb` in the hut at (2.83, 0, 1.85), rotationY −π/2, colliders in `hut.json` and the machine's JSON. Interact within 2.5 m opens a panel in the merchant's style, by day and by night. Data: `src/data/vending.ts`; rules: `src/game/systems/vending.ts`.

| Row | ID | Item | Qty | Price | Per day | Needs | Handle |
|---|---|---|---|---|---|---|---|
| 0 | `revolver-cartridge` | Revolver Cartridges | 6 | 12 | 2 | Revolver | `handle-0` |
| 1 | `shotgun-shell` | Shotgun Shells | 4 | 14 | 2 | Shotgun | `handle-1` |
| 2 | `lamp-oil` | Lamp Oil | 1 | 5 | 3 | — | `handle-2` |
| 3 | `kola-tonic` | Kola Tonic | 1 | 18 | 1 | — | `handle-3` |
| 4 | `brisk-draught` | Brisk Draught | 1 | 15 | 1 | — | `handle-4` |
| 5 | `bandage` | Bandage | 1 | 7 | 2 | — | `handle-2` (shared with Lamp Oil) |

- **Never stocked:** relics, key items, journal pages, recipes, clues, holy water, silver filings.
- A gun's row shows only while the gun is owned (the elite-drop ownership rule, §7).
- Each row shows the name, the price, "N left" today and a one-sentence description; an empty row shows a "Sold out" card.
- **Buying** (within 1.2 s): the price is paid, the row's stock drops by 1, a coin clinks, the row's handle pulls out 5 cm (±1 cm) and springs back, and the goods drop into the tray and the satchel. The keeper is not protected and the world keeps running; Esc still pauses.
- **Refusals** leave coins, stock and the satchel unchanged and say why: the coins short (with the shortfall), the satchel full, or sold out. Coins never go below 0.
- **Dawn** resets every row to its per-day stock.
- The marquee glass is emissive; one small warm shadowless light at `marquee-light` is added only where the frame budget allows.
- Sounds: coin clink, handle pull, tray drop, refusal, each with a caption and played from the machine.
- **Brisk Draught** (`brisk-draught`, `items/brisk-draught.glb`): +25% move speed for 60 s; see the timed effects (§4).

### 14.7 Hands and lantern light (11, H7)
Models: `public/assets/models/viewmodel/hands.glb` (clips Grip-Pistol, Grip-Haft, Grip-Long, Lantern-Hold, Throw, Reload-Revolver, Reload-Shotgun, Swing-Light, Swing-Heavy) and `viewmodel/lantern.glb` (with `glass` and `flame` meshes). Data: `src/data/lanternLight.ts`; rules: `gripClass.ts`, `lanternHand.ts`, `lanternFlicker.ts`.

| Weapon | Grip |
|---|---|
| `revolver` | Pistol |
| `shotgun` | Long |
| `rusty-shovel` | Haft |
| `sharpened-shovel` | Haft |
| `wood-axe` | Haft |
| `bone-club` | Haft |
| `silver-sabre` | Haft |

| Hands | Value |
|---|---|
| Grip switch | Within 0.3 s of changing weapon |
| Lantern sway lag | 80 ms (±20 ms), with follow-through on turns; steady with Head bob off |
| Sprint drop | 0.05 to 0.15 m lower |
| Shotgun | Left hand on the fore-end, lantern hooked on the belt, light from the hip pointing forward and 10° to 20° down; back in the hand within 0.5 s after switching away |
| Belt caption | "Lantern hooked to your belt", once per run (cleared by New Game, kept by Continue and the retries) |
| Throw or heavy swing (axe, sabre) | The lantern hangs from the wrist strap, still lit, and is caught again within 0.6 s |
| Missing hands or lantern model | Today's weapon-only viewmodel; the light comes from a fixed offset from the camera |

| Light | Value |
|---|---|
| Spot | One, shadow-casting, shadow map 1024 or smaller, cookie of the cage bars (`public/assets/textures/lantern-cookie.png`) |
| Fill | One point light, no shadow, radius 3 m or less |
| Colour | `#ffb46b` (about 1900 K); below 15% oil `#ff6a3a` |
| Origin | The lantern glass in the left hand, or the belt hook with the shotgun |
| Breathing | 0.2 to 0.5 Hz |
| Gutters | 4 to 12 Hz |
| Dips | Up to −25% of base |
| Low oil (below 15%) | Gutter amplitude ×2 or more, redder |
| Sprint or gust | Gutter amplitude ×1.5 or more |
| Oil at 0 | One flare of 0.3 s or less, then out; glass and flame show no emission |
| Bride within 8 m | Light ×0.7 |
| Flashing lights off | Changes slower than 1 Hz; no step over 10% of base per frame |
| Low graphics | No cookie; the spot keeps its shadow |
| Bloom | The flame and glass glow through the scene's existing global bloom (threshold 1): both are drawn in HDR so they cross it. Other emissives (windows, turnip lanterns) bloom as they did before. **As built (task 6.7):** a selective bloom limited to the flame and glass doubled frame time (6.9 to 11-13 ms by day, 8.5 to 18.6 ms in the night wave at 1080p), so the "flame and glass only" wording is relaxed to this. Frame time is back to the baseline (6.9 ms, `e2e/logs/lantern-perf-after.json`). |

Range and brightness follow the oil (8 m full, 2 m empty, §11 Lantern), times the flicker signal; the flame scale and glass glow follow the same signal in the same frame. This light replaces today's lantern light, so the scene keeps at most 4 shadow-casting lights; GPU perf is measured before the first code task and after the last.

### 14.8 Settings and controls (11)
| Setting | Values | Default | Saved |
|---|---|---|---|
| Jumpscares | Full, Reduced, Off | Full | With the other settings; an unknown stored value loads as Full |
| Show info dots | On, Off | On | With the other settings |

- Jumpscares sits next to Scare intensity in the Settings menu. Scare intensity keeps governing the §9 scare director; Jumpscares governs only the screen faces.
- Every new panel and tooltip works by keyboard with a visible focus state; every new cue has a non-colour form (shape, glyph, text or position).
- Every new pulse, flash or strobe becomes a steady or slow change (under 3 per second) with Flashing lights off.
- No new keys: the vending machine uses Interact (§10).

### 14.9 Cut list (11)
Feature freeze: **2026-11-26**. No new feature task of spec 11 starts after it. Cut from the bottom of this list first, and mark the cut subsection here as "cut" in the same change.

| Priority | Feature | Subsection | Spec 11 task | Status |
|---|---|---|---|---|
| 1 | H6 vending machine | 14.6 | 2 | Built |
| 2 | H1 screen jumpscares | 14.1 | 3 | Planned |
| 3 | H4 bats | 14.4 | 4 | Planned |
| 4 | H5 info dots | 14.5 | 5 | Planned |
| 5 | H7 hands and lantern light | 14.7 | 6 | Planned |
| 6 | H2 new creatures and H3 zombie looks | 14.2, 14.3 | 7, 8 | Planned |

This section, the waiting list and the shared rules are never cut.

## 15. All Hallows' Eve dressing

The game is set in October 1891, so the grounds dress for Allhallowtide. This is look and sound only: it changes no rule, number or objective. Tuning lives in `src/data/allHallows.ts`; the rules are pure functions in `src/game/systems/allHallows.ts`.

- **Turnip lanterns.** Carved turnips with a candle inside: the 1890s British and Irish jack-o'-lantern, not a pumpkin. Two flank the hut step and six sit at the foot of the readable headstones, the oak-hollow grave and the chapel path. Each throws a warm pool of light on the ground; there are no real lights (light budget). The flame flickers by slow and quick waves, never in step with its neighbours, and barely moves with Flashing lights off.
- **Autumn leaves.** About 160 brown, orange and rust leaves (half on Low graphics) fall, tumble and skate across the ground on a north-west wind with slow gusts, harder in a storm. They follow the camera in a 26 m box and never appear inside the hut, the chapel or the crypts.
- **Palette.** Dusk is a warmer amber; night is cold with a faint violet cast. The night still keeps its rim of light (horror-design rule).
- **Harvest moon.** A big, low amber moon with a halo, about 9° across, behind the chapel as you walk to its door from the hut. It rises through dusk, is full at night, fades at dawn, is gone by day and is only a smudge under storm cloud. The chapel, trees and walls in front of it hide it.
- **Sound.** A wind bed through the bare branches all day, loudest at night and muffled indoors (filtered noise until `ambience/wind-night.ogg` exists). Crows call from the trees every 12 to 30 s by day, dusk and dawn, never at night. Through the night, every 70 to 130 s, a far-off village bell tolls three times for All Souls, small and muffled, so it is never mistaken for the chapel's dusk bell. Crows and the bell are recorded only (`--batch halloween` in `tools/audio`). They are ambience, not important sounds, so they have no subtitles.
