# Last Rites: Design Bible

Source of truth for all game content. Code in `src/data/` mirrors these tables. If they disagree, this file wins; update the code.

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
| **Keeper's Hut and Grounds** | Start | Open, foggy, crooked headstones, dead oaks | Workbench, most materials, 2 relics, the chapel exterior |
| **Mausoleum Row** | **Rusted Crypt Key** (found night 1, Marsh grave) | Narrow stone alleys, dark, echoing, statues | Scare alleys, Crane crypt, 1 relic |
| **Chapel** | Always (repair to make it a safe zone) | Ruined, candlelit | Altar, bell, repairs |
| **Catacombs** | **Sexton's Bone Whistle** (Mausoleum Row) opens the hidden stair behind the altar | Tight tunnels, bone walls, drips, near-total dark | Ossuary, 2 relics; **Iron Ossuary Key** (on Elias's body in the Crane crypt) opens the deepest chamber |

### Chapel repairs (permanent upgrades)
| Stage | Cost | Effect |
|---|---|---|
| 1. Bar the door | 4 iron nails, 2 bone | Zombies cannot enter the chapel. True safe zone. |
| 2. Relight the altar | 3 candle wax, 1 holy water | Saves the game at the altar and heals 25 HP per visit per day |
| 3. Rehang the bell | 6 iron nails, 2 cloth | Bell rings 20 s before each wave and reveals spawn directions on the map |

---

## 3. Items

### Materials (stack limit 10 each)
| ID | Name | Found |
|---|---|---|
| `bone` | Bone | Disturbed graves, catacomb walls |
| `iron-nail` | Iron Nails | Broken coffins, fences |
| `candle-wax` | Candle Wax | Crypt shelves, chapel |
| `holy-water` | Holy Water | Chapel font (refills daily: 2), rare in crypts |
| `cloth` | Cloth | Shrouds, the hut |
| `lamp-oil` | Lamp Oil | Hut, mausoleum lamps |
| `grave-salt` | Grave Salt | Catacombs, Crane crypt |

### Key items (no slot cost, shown in the journal)
`rusted-crypt-key`, `bone-whistle`, `iron-ossuary-key`, `parish-ledger`, `journal-page-1` … `journal-page-5`

### Relics (no slot cost)
| ID | Name | Location |
|---|---|---|
| `crane-rosary` | Crane's Rosary | Crane crypt sarcophagus (Mausoleum Row) |
| `sextons-bell-clapper` | Sexton's Bell Clapper | Under the collapsed bell tower (Grounds) |
| `childs-locket` | Child's Locket | Smallest grave, west hill (Grounds), only appears at night |
| `burial-shroud` | Burial Shroud | Ossuary (Catacombs) |
| `reliquary-heart` | Reliquary Heart | Deepest chamber (Catacombs, Iron Ossuary Key) |

### Satchel
- 12 slots. Each material stack and each crafted item takes one slot.
- Key items and relics don't use slots.

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

Crafting happens only at the **workbench** (keeper's hut). Crafting takes 1.5 s and the world keeps running, so crafting at night is a risk.

---

## 6. Player

| Stat | Value |
|---|---|
| Health | 100 (regenerates only via bandage or the altar) |
| Walk / sprint speed | 3.0 / 5.5 m/s |
| Stamina | 100; sprint drains 20/s, regenerates 15/s after 1 s |
| Lantern fuel | 100%; drains 1% per 6 s by day, 1% per 3 s by night |
| Lantern radius | 8 m at 100% fuel, scaling down to 2 m at 0% |
| Interact range | 2.5 m |

Taking damage: brief red vignette (disabled when flashing lights is off), the lantern flame dips, and a heartbeat plays below 30 HP.

---

## 7. Enemies

| ID | Name | HP | Speed | Damage | Behaviour | Audio signature |
|---|---|---|---|---|---|---|
| `shambler` | Shambler | 60 | 1.4 m/s | 10 | Walks straight at the player in groups. Basic wave fodder. | Wet dragging footsteps, groans |
| `lurker` | Lurker | 90 | 0 → 6 m/s lunge | 20 | Waits motionless in dark alleys and niches. Lunges when the player is within 4 m and not facing it, or when the lantern is low. **Used by the scare director.** | Silence, then a sharp breath |
| `wailer` | Wailer | 50 | 2.0 m/s | 5 | Keeps its distance. Screams every 8 s, pulling all zombies within 25 m toward the player. Priority target. | Rising wail, audible from 40 m |

Zombies take 50% less damage while the player stands in darkness (lantern fuel 0) and flinch away from tallow candles for 1 s.

---

## 8. Day / night cycle

| Phase | Length | What happens |
|---|---|---|
| Day | 6 min real time | Exploration and collecting. Lurkers can appear in Mausoleum Row and Catacombs. |
| Dusk | 30 s | The bell tolls (if repaired), the sky turns red, music swells, and the player should return. |
| Night | Until all waves are cleared | Waves from open graves. Fog thickens each night. |
| Dawn | 10 s | Summary card: zombies banished, items found, recipe unlocked, journal page available. |

### Waves
| Night | Waves | Composition per wave | Fog density |
|---|---|---|---|
| 1 | 2 | 4 shamblers | 0.02 |
| 2 | 3 | 5 shamblers, 1 wailer (last wave) | 0.03 |
| 3 | 3 | 6 shamblers, 1 wailer, 1 lurker | 0.04 |
| 4 | 4 | 6 shamblers, 2 wailers, 2 lurkers | 0.05 |
| 5 | 5 + final rite | 8 shamblers, 2 wailers, 2 lurkers | 0.06 |

**Final rite (night 5):** the player places the relics on the altar and holds *Interact* for 45 s while zombies attack the chapel. Repair stage 1 (barred door) slows them down but doesn't stop them in this event.

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
| Attack / throw | Left mouse |
| Block / aim throw | Right mouse |
| Hotbar slots | 1–4 |
| Satchel | Tab |
| Journal / map | J |
| Lantern on/off | F |
| Pause | Esc |
