// Shared domain types for Last Rites.
// Pure TypeScript — no React, three.js or Howler imports.

import type { EnemyId } from '../data/enemies'

export type Phase = 'day' | 'dusk' | 'night' | 'dawn'

// ---------------------------------------------------------------------------
// Screen state machine
// ---------------------------------------------------------------------------

export type Screen = 'content-warning' | 'loading' | 'title' | 'game' | 'ending'

// ---------------------------------------------------------------------------
// Item IDs
// ---------------------------------------------------------------------------

/** Stackable material IDs */
export type MaterialId =
  | 'bone'
  | 'iron-nail'
  | 'candle-wax'
  | 'holy-water'
  | 'cloth'
  | 'lamp-oil'
  | 'grave-salt'
  | 'wood-plank'
  | 'black-powder'
  | 'lead-shot'
  | 'silver-filings'

/** Ammunition IDs (each stack takes one satchel slot) */
export type AmmoId = 'revolver-cartridge' | 'shotgun-shell'

/** Firearm IDs */
export type FirearmId = 'revolver' | 'shotgun'

/** Heavy melee weapon IDs */
export type HeavyMeleeId = 'wood-axe' | 'silver-sabre'

/** Chapel door IDs */
export type DoorId = 'front' | 'vestry'

/** Timed effect IDs */
export type EffectId = 'blessed-rounds' | 'adrenaline' | 'salt-circle'

/** Weapon upgrade IDs */
export type UpgradeId =
  | 'up-revolver-cylinder'
  | 'up-revolver-speedloader'
  | 'up-revolver-barrel'
  | 'up-shotgun-choke'
  | 'up-shotgun-belt'
  | 'up-shotgun-heavy'
  | 'up-axe-haft'
  | 'up-axe-edge'
  | 'up-sabre-blessed'
  | 'up-sabre-hilt'

/** What dealt damage to a zombie */
export type DamageSource =
  | 'melee'
  | 'heavy'
  | 'kick'
  | 'revolver'
  | 'shotgun'
  | 'holy-water-flask'
  | 'nail-bomb'
  | 'lantern-trap'
  | 'burst'

/** Crafted weapon / tool / consumable IDs */
export type CraftedItemId =
  | 'rusty-shovel'
  | 'bone-club'
  | 'sharpened-shovel'
  | 'holy-water-flask'
  | 'lantern-trap'
  | 'nail-bomb'
  | 'salt-circle'
  | 'bandage'
  | 'tallow-candle'
  | 'lantern-refill'
  | FirearmId
  | HeavyMeleeId
  | 'blessed-rounds'
  | 'kola-tonic'

/** Key item IDs — do not occupy satchel slots */
export type KeyItemId =
  | 'rusted-crypt-key'
  | 'bone-whistle'
  | 'iron-ossuary-key'
  | 'parish-ledger'
  | 'journal-page-1'
  | 'journal-page-2'
  | 'journal-page-3'
  | 'journal-page-4'
  | 'journal-page-5'

/** Relic IDs — do not occupy satchel slots */
export type RelicId =
  | 'crane-rosary'
  | 'sextons-bell-clapper'
  | 'childs-locket'
  | 'burial-shroud'
  | 'reliquary-heart'

/** Any item that can appear in the satchel */
export type ItemId = MaterialId | CraftedItemId | KeyItemId | RelicId | AmmoId

/** Ending IDs (design bible §1) */
export type EndingId = 'rest' | 'uneasy-peace' | 'taken'

/** Journal page numbers */
export type PageNumber = 1 | 2 | 3 | 4 | 5

/** Recipe IDs */
export type RecipeId =
  | 'r-bone-club'
  | 'r-bandage'
  | 'r-tallow-candle'
  | 'r-lantern-refill'
  | 'r-sharpened-shovel'
  | 'r-holy-water-flask'
  | 'r-lantern-trap'
  | 'r-nail-bomb'
  | 'r-salt-circle'
  | 'r-revolver-cartridge'
  | 'r-shotgun-shell'
  | 'r-blessed-rounds'

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** A stack of a single item in the satchel */
export interface ItemStack {
  item: ItemId
  qty: number
}

/**
 * The player's satchel.
 *
 * - `slots` holds material stacks and crafted items (max 12 slots, max 10 per material stack).
 * - `keyItems` and `relics` don't use slots.
 * - `hotbar` maps slot index 0-3 to an item currently quick-equipped.
 */
export interface Inventory {
  /** Up to 12 slots. Each entry is one stack (one slot). */
  slots: ItemStack[]
  keyItems: KeyItemId[]
  relics: RelicId[]
  /**
   * Hotbar bindings: index 0–3 → item equipped in that slot, or null.
   * Used to preserve the hotbar slot when a tool is replaced (e.g. rusty-shovel → sharpened-shovel).
   */
  hotbar: [ItemId | null, ItemId | null, ItemId | null, ItemId | null]
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

/** Full player state used by the GameLoop systems and PlayerStore. */
export interface PlayerState {
  /** World-space position [x, y, z] */
  position: [number, number, number]
  /** Horizontal look angle in radians */
  yaw: number
  /** Vertical look angle in radians, clamped to ±85° */
  pitch: number
  /** 0–100 HP; regenerates only via bandage or altar */
  health: number
  /** 0–100; drained by sprinting, regenerated after 1 s of non-sprint */
  stamina: number
  /** The item or interactable currently under the crosshair within 2.5 m, or null */
  interactTarget: ItemId | null
}

// ---------------------------------------------------------------------------
// World / day-night state
// ---------------------------------------------------------------------------

/** World state owned by the day/night system and GameLoop. */
export interface WorldState {
  /** Current phase in the day/night cycle */
  phase: Phase
  /** Seconds elapsed in the current phase */
  phaseTime: number
  /** Which night we are on (1–5) */
  nightNumber: number
  /** Current fog density (fed to THREE.FogExp2) */
  fogDensity: number
  /** True once all zombie waves for this night have been cleared */
  wavesCleared: boolean
}

// ---------------------------------------------------------------------------
// Lantern state
// ---------------------------------------------------------------------------

export interface LanternState {
  /** Whether the lantern is switched on */
  on: boolean
  /** 0–100 percent fuel remaining */
  fuel: number
  /** True when fuel < 20% — drives the flicker animation in Lantern.tsx */
  flicker: boolean
}

// ---------------------------------------------------------------------------
// Stamina state (pure sub-state used by the stamina system)
// ---------------------------------------------------------------------------

export interface StaminaState {
  /** 0–100 stamina */
  stamina: number
  /**
   * Countdown timer in seconds. Regen only fires when this reaches 0.
   * Reset to 1 s every time the player starts sprinting.
   */
  regenDelayTimer: number
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** All accessibility and comfort settings (accessibility steering doc). */
export interface Settings {
  /** Jumpscare / scare event intensity */
  scareIntensity: 'full' | 'reduced' | 'off'
  /** Whether light-flash effects are shown */
  flashingLights: boolean
  /** Whether camera shake is enabled */
  cameraShake: boolean
  /** Whether first-person head bob is enabled */
  headBob: boolean
  /** Camera field of view in degrees (60–100) */
  fov: number
  /** Mouse look sensitivity multiplier (0.1–3.0) */
  mouseSensitivity: number
  /** Invert vertical mouse look */
  invertY: boolean
  /** Whether subtitles are shown */
  subtitles: boolean
  /** Master volume (0–100) */
  masterVolume: number
  /** Music volume (0–100) */
  musicVolume: number
  /** SFX volume (0–100) */
  sfxVolume: number
  /** Gamma / brightness adjustment (0.8–1.4) */
  brightness: number
  /** Show numeric values alongside visual indicators in the HUD */
  accessibleHUD: boolean
  /** Show first-day tutorial prompts in the objective tracker */
  tutorialPrompts: boolean
  /** Show floating damage numbers on hits */
  damageNumbers: boolean
  /** Show the HUD minimap (the Minimap binding toggles it) */
  showMinimap: boolean
  /** Draw a faint beacon at each map pin in the world */
  showPinsInWorld: boolean
  /** Key bindings: action name → KeyboardEvent.code */
  bindings: Record<string, string>
}

// ---------------------------------------------------------------------------
// Game events (value objects — not DOM events)
// ---------------------------------------------------------------------------

/**
 * Typed union of all game events.
 * Systems return `GameEvent[]`; the GameLoop publishes them to the event bus
 * after each tick. Later specs add to this union.
 */
export type GameEvent =
  | { type: 'nightStarted';   nightNumber: number }
  | { type: 'dawnStarted';    nightNumber: number }
  | { type: 'phaseChanged';   phase: Phase }
  | { type: 'playerDamaged';  amount: number }
  | { type: 'itemCollected';  itemId: ItemId }
  | { type: 'craftCompleted'; recipeId: RecipeId }
  | { type: 'hotbarBound';    slot: 0 | 1 | 2 | 3 }
  | { type: 'journalOpened' }
  | { type: 'caseTabOpened' }
  | { type: 'lanternToggled'; on: boolean }
  | { type: 'scareFired';     scareId: string }
  | { type: 'subtitleShown';  text: string; duration: number; force?: boolean }
  | { type: 'digCompleted';   graveId: string; loot: ItemStack[]; scareId: string | null }
  | { type: 'digCancelled';   graveId: string; reason: 'moved' | 'hit' | 'released' | 'interrupted' }
  | { type: 'enemyKilled';    uid: string; enemy: EnemyId; source: DamageSource; headshot: boolean; elite: boolean }
  | { type: 'firearmFired';   weapon: FirearmId; hit: boolean }
  | { type: 'boardNailed';    door: DoorId }
  | { type: 'boardBroken';    door: DoorId }
  | { type: 'bossRisen' }
  | { type: 'bossDefeated' }
  | { type: 'meleeHit';       uid: string }
  | { type: 'nightCleared';   nightNumber: number }
  | { type: 'thunderRolled';  close: boolean }

// ---------------------------------------------------------------------------
// Progression and atmosphere ids (spec 08)
// ---------------------------------------------------------------------------

export type ModeId = 'easy' | 'normal' | 'hard' | 'endless'
export type DawnUpgradeId =
  | 'iron-constitution' | 'steady-hands' | 'long-wick' | 'deep-pockets' | 'second-wind'
  | 'gravedigger' | 'hardened-boards' | 'grim-harvest' | 'marksman' | 'blessed-reach'
export type ContractId =
  | 'c-dig-3' | 'c-shotgun-5' | 'c-revolver-head-3' | 'c-melee-10'
  | 'c-wailer-2' | 'c-boards-3' | 'c-gather-8' | 'c-unhurt'
export type AchievementId =
  | 'a-first-light' | 'a-grave-robber' | 'a-marksman' | 'a-close-shave' | 'a-combo'
  | 'a-barricade' | 'a-pages' | 'a-relics' | 'a-crane' | 'a-rest' | 'a-endless-10' | 'a-patron'
export type MerchantRowId =
  | 'bandage' | 'lamp-oil' | 'revolver-cartridges' | 'shotgun-shells' | 'holy-water'
  | 'black-powder' | 'lead-shot' | 'wood-planks' | 'kola-tonic' | 'silver-filings'
