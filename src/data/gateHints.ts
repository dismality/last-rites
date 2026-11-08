// Gate copy and placement, as data. Hints point toward where the key lies
// (design bible §2, §3) without naming coordinates.

import type { MysteryGateId } from '../game/systems/mystery'
import type { Vec3 } from './cemeteryLayout'

/** Where a gate's key is used. The catacomb stair is revealed at the altar, not at its mouth. */
export type GateUseSite = 'gate' | 'altar'

export interface GateDef {
  readonly id: MysteryGateId
  readonly name: string
  readonly site: GateUseSite
  /** Shown when the player tries the gate without its key. */
  readonly hintMissingKey: string
  /** Shown when the key is held but this is the wrong place to use it. */
  readonly hintWrongSite?: string
  /** Shown (and subtitled) when the gate opens. */
  readonly unlockText: string
  /** Sound description for the subtitle track. */
  readonly unlockSound: string
}

export const GATE_DEFS: Readonly<Record<MysteryGateId, GateDef>> = {
  'mausoleum-row': {
    id: 'mausoleum-row',
    name: 'Mausoleum Row gate',
    site: 'gate',
    hintMissingKey:
      'The gate is locked. A rusted key bearing the Crane name might lie near the Marsh family grave.',
    unlockText: 'The rusted lock gives way.',
    unlockSound: '[Iron grinds and the gate swings open]',
  },
  catacombs: {
    id: 'catacombs',
    name: 'Catacombs stair',
    site: 'altar',
    hintMissingKey:
      'The stair is sealed. The sexton kept a bone whistle somewhere in Mausoleum Row. The altar may answer it.',
    hintWrongSite: 'The stair does not stir. Perhaps the whistle belongs at the chapel altar.',
    unlockText: 'Stone shifts beyond the altar. A stair is open.',
    unlockSound: '[Stone grinds behind the altar]',
  },
  ossuary: {
    id: 'ossuary',
    name: 'Ossuary door',
    site: 'gate',
    hintMissingKey:
      'The iron door will not budge. A keeper in the Crane crypt may still hold the key.',
    unlockText: 'The iron door opens onto the deepest chamber.',
    unlockSound: '[Iron door scrapes open]',
  },
}

/** Deepest catacomb chamber door: inside the catacombs corridor (x 25, z 40..60) between the shroud and the heart. */
export const OSSUARY_DOOR = {
  /** Centre of the doorway in corridor-local x, world z. */
  z: 55.6,
  /** Matches CATACOMBS width/height in cemeteryLayout.ts. */
  width: 2.5,
  height: 2.2,
  thickness: 0.2,
} as const

/** Altar whistle spot relative to the chapel centre (matches ALTAR_OFFSET in Chapel.tsx). */
export const ALTAR_WHISTLE_OFFSET: Vec3 = [0, 0, 4.5]

/** Seconds the opened gate's bars take to lift out of the way. */
export const GATE_LIFT_SECONDS = 1.2
