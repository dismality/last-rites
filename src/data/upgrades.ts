// Weapon upgrades mirrored from docs/game-design.md §4 "Weapon upgrades (07)".
import type { FirearmId, HeavyMeleeId, ItemStack, UpgradeId } from '../game/types'

export type StatKey =
  | 'capacity'
  | 'reloadS'
  | 'damage'
  | 'spreadHipDeg'
  | 'pelletDamage'
  | 'durability'
  | 'lightDamage'
  | 'heavyDamage'
  | 'heavyStaminaCost'

export interface UpgradeDef {
  id: UpgradeId
  weapon: FirearmId | HeavyMeleeId
  name: string
  cost: ItemStack[]
  changes: { stat: StatKey; from: number; to: number }[]
}

export const WEAPON_UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'up-revolver-cylinder', weapon: 'revolver', name: 'Larger Cylinder',
    cost: [{ item: 'iron-nail', qty: 4 }, { item: 'lead-shot', qty: 2 }],
    changes: [{ stat: 'capacity', from: 6, to: 8 }],
  },
  {
    id: 'up-revolver-speedloader', weapon: 'revolver', name: 'Speed Loader',
    cost: [{ item: 'cloth', qty: 2 }, { item: 'wood-plank', qty: 1 }, { item: 'iron-nail', qty: 2 }],
    changes: [{ stat: 'reloadS', from: 2.4, to: 1.4 }],
  },
  {
    id: 'up-revolver-barrel', weapon: 'revolver', name: 'Rifled Barrel',
    cost: [{ item: 'iron-nail', qty: 3 }, { item: 'silver-filings', qty: 1 }],
    changes: [{ stat: 'damage', from: 34, to: 44 }],
  },
  {
    id: 'up-shotgun-choke', weapon: 'shotgun', name: 'Choke',
    cost: [{ item: 'iron-nail', qty: 3 }],
    changes: [{ stat: 'spreadHipDeg', from: 6, to: 4 }],
  },
  {
    id: 'up-shotgun-belt', weapon: 'shotgun', name: 'Shell Belt',
    cost: [{ item: 'cloth', qty: 2 }, { item: 'lead-shot', qty: 1 }],
    changes: [{ stat: 'reloadS', from: 2.0, to: 1.3 }],
  },
  {
    id: 'up-shotgun-heavy', weapon: 'shotgun', name: 'Heavy Shot',
    cost: [{ item: 'lead-shot', qty: 3 }, { item: 'black-powder', qty: 1 }],
    changes: [{ stat: 'pelletDamage', from: 9, to: 12 }],
  },
  {
    id: 'up-axe-haft', weapon: 'wood-axe', name: 'Iron-Banded Haft',
    cost: [{ item: 'iron-nail', qty: 3 }, { item: 'wood-plank', qty: 1 }],
    changes: [{ stat: 'durability', from: 60, to: 100 }],
  },
  {
    id: 'up-axe-edge', weapon: 'wood-axe', name: 'Honed Edge',
    cost: [{ item: 'iron-nail', qty: 2 }, { item: 'bone', qty: 1 }],
    changes: [
      { stat: 'lightDamage', from: 30, to: 38 },
      { stat: 'heavyDamage', from: 70, to: 88 },
    ],
  },
  {
    id: 'up-sabre-blessed', weapon: 'silver-sabre', name: 'Blessed Edge',
    cost: [{ item: 'holy-water', qty: 1 }, { item: 'silver-filings', qty: 1 }],
    changes: [
      { stat: 'lightDamage', from: 28, to: 34 },
      { stat: 'heavyDamage', from: 60, to: 72 },
    ],
  },
  {
    id: 'up-sabre-hilt', weapon: 'silver-sabre', name: 'Basket Hilt',
    cost: [{ item: 'iron-nail', qty: 3 }, { item: 'cloth', qty: 1 }],
    changes: [{ stat: 'heavyStaminaCost', from: 20, to: 12 }],
  },
]

export const UPGRADE_MAP: Readonly<Record<UpgradeId, UpgradeDef>> = Object.fromEntries(
  WEAPON_UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>
