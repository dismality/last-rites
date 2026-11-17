// The hut's vending machine, the "Hollowmere Automatic Dispenser" (spec 11 H6), mirrored from
// docs/game-design.md §14.6. Pure data: no logic, no side effects. Rules: game/systems/vending.ts.

import type { ItemId } from '../game/types'

/** Row ids are the item ids they sell (§14.6 "ID" column). */
export type VendingRowId = 'revolver-cartridge' | 'shotgun-shell' | 'lamp-oil' | 'kola-tonic' | 'brisk-draught' | 'bandage'
export type HandleIndex = 0 | 1 | 2 | 3 | 4

export interface VendingRow {
  id: VendingRowId
  item: ItemId
  /** Display name (§14.6 "Item"). */
  name: string
  /** Items handed over per purchase. */
  qty: number
  /** Price in Grave Coins. */
  price: number
  /** Stock at dawn. */
  perDay: number
  /** The row shows only while this gun is owned (the elite-drop ownership rule). */
  requiresWeapon?: 'revolver' | 'shotgun'
  /** Which `handle-N` anchor pulls on a purchase. Bandage shares Lamp Oil's handle. */
  handle: HandleIndex
  /** One sentence on what the item does, shown in the panel. */
  blurb: string
}

export const VENDING_ROWS: readonly VendingRow[] = [
  { id: 'revolver-cartridge', item: 'revolver-cartridge', name: 'Revolver Cartridges', qty: 6, price: 12, perDay: 2, requiresWeapon: 'revolver', handle: 0, blurb: 'Six rounds for the service revolver.' },
  { id: 'shotgun-shell', item: 'shotgun-shell', name: 'Shotgun Shells', qty: 4, price: 14, perDay: 2, requiresWeapon: 'shotgun', handle: 1, blurb: 'Four shells for the double-barrel shotgun.' },
  { id: 'lamp-oil', item: 'lamp-oil', name: 'Lamp Oil', qty: 1, price: 5, perDay: 3, handle: 2, blurb: 'Oil for crafting lantern refills, lantern traps and nail bombs.' },
  { id: 'kola-tonic', item: 'kola-tonic', name: 'Kola Tonic', qty: 1, price: 18, perDay: 1, handle: 3, blurb: 'Adrenaline for 20 seconds: faster on your feet, slower to tire.' },
  { id: 'brisk-draught', item: 'brisk-draught', name: 'Brisk Draught', qty: 1, price: 15, perDay: 1, handle: 4, blurb: 'Moves you 25% faster for 60 seconds.' },
  { id: 'bandage', item: 'bandage', name: 'Bandage', qty: 1, price: 7, perDay: 2, handle: 2, blurb: 'Heals 30 health over two seconds.' },
]

/**
 * Never stocked (§14.6): relics, key items, journal pages, recipes, clues, holy water and silver
 * filings. Item kinds cover relics, key items and journal pages (lore); the ids name the rest.
 */
export const VENDING_FORBIDDEN_KINDS = ['relic', 'key', 'lore'] as const
export const VENDING_FORBIDDEN: readonly string[] = ['holy-water', 'holy-water-flask', 'silver-filings']
/** Recipes and clues are not satchel items; an id with these prefixes is refused too. */
export const VENDING_FORBIDDEN_PREFIXES: readonly string[] = ['r-', 'clue-', 'journal-page-']

/** Interact range (m), the same as the merchant's. */
export const VENDING_RANGE_M = 2.5

/** Purchase animation: the handle pulls out this far (m) and springs back. */
export const VENDING_HANDLE_PULL_M = 0.05
/** Out, hold, back (s); the whole purchase finishes within VENDING_PURCHASE_S. */
export const VENDING_HANDLE_OUT_S = 0.25
export const VENDING_HANDLE_HOLD_S = 0.2
export const VENDING_HANDLE_BACK_S = 0.45
export const VENDING_PURCHASE_S = 1.2

/** The marquee's small warm light (no shadow), only where the frame budget allows. */
export const VENDING_MARQUEE_LIGHT = { color: '#ffcf8a', intensity: 0.6, distance: 2.5 } as const
/** The light is skipped when the mean frame time is above this (ms), i.e. below ~60 fps. */
export const VENDING_LIGHT_FRAME_BUDGET_MS = 16.7
/** And when the scene already has this many shadow-casting lights (the cap is 4). */
export const VENDING_LIGHT_SHADOW_CAP = 4

/**
 * Anchors in the model's own space, from public/assets/models/props/vending-machine.json (the test
 * vending data mirrors them). The GLB has the handles merged into its brass mesh, so the game draws
 * its own small knobs at these points to animate.
 */
export const VENDING_ANCHORS = {
  marqueeLight: [0, 1.62, 0.38],
  coinSlot: [0.22, 1.0, 0.25],
  tray: [0.22, 0.62, 0.28],
  handles: [
    [-0.24, 0.78, 0.29],
    [-0.14, 0.78, 0.29],
    [-0.04, 0.78, 0.29],
    [0.06, 0.78, 0.29],
    [0.16, 0.78, 0.29],
  ],
} as const satisfies {
  marqueeLight: readonly [number, number, number]
  coinSlot: readonly [number, number, number]
  tray: readonly [number, number, number]
  handles: readonly (readonly [number, number, number])[]
}
/** The machine's collider box in its own space (the same box is in hut.json). */
export const VENDING_BOX = { center: [0, 0.96, 0], half: [0.39, 0.96, 0.26] } as const
/** When the goods land in the tray (s into the purchase), and how long they show there. */
export const VENDING_TRAY_DROP_S = 0.45
export const VENDING_TRAY_SHOW_S = 1.2
