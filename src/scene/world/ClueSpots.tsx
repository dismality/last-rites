// Environmental clues: small props the player can examine to record a clue.
// Rules (ledger required or not) live in the mystery store; this only draws and wires them.
import { CLUE_SPOTS, type ClueSpot } from '../../data/tombstones'
import { pushJournalAddedToast } from '../../game/state/journalToast'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useToastStore } from '../../game/state/toastStore'
import { canDiscoverClue } from '../../game/systems/tombstones'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { Interactable } from './Interactable'
import { PART_MATERIALS } from './partMaterials'

/** The clue's outline fades in inside this distance (spec 09 task 11o). */
const CLUE_OUTLINE_RANGE_M = 4

function examineSpot(spot: ClueSpot): void {
  if (!canDiscoverClue(spot.clueId, useInventoryStore.getState().inventory)) {
    useToastStore.getState().push('The entries mean nothing without the parish ledger to compare.')
    return
  }
  useMysteryStore.getState().discoverClue(spot.clueId)
}

function Prop({ kind }: { kind: ClueSpot['prop'] }) {
  switch (kind) {
    case 'parchment':
      return (
        <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.05]} material={PART_MATERIALS.floor}>
          <boxGeometry args={[0.35, 0.45, 0.02]} />
        </mesh>
      )
    case 'coat':
      return (
        <mesh position={[0, 0.08, 0]} material={PART_MATERIALS.darkWood} castShadow>
          <boxGeometry args={[1.5, 0.16, 0.6]} />
        </mesh>
      )
    case 'marks':
      return (
        <mesh position={[0, 0.02, 0]} material={PART_MATERIALS.trim}>
          <boxGeometry args={[0.5, 0.04, 0.35]} />
        </mesh>
      )
  }
}

export function ClueSpots() {
  return (
    <>
      {CLUE_SPOTS.map((spot) => (
        <group key={spot.clueId} position={spot.position}>
          <Interactable
            id={`clue-${spot.clueId}`}
            kind="clue-spot"
            subject={spot.clueId}
            onUsedUp={pushJournalAddedToast}
            outlineRange={CLUE_OUTLINE_RANGE_M}
            runeHeight={0.9}
            onInteract={() => examineSpot(spot)}
          >
            <Prop kind={spot.prop} />
          </Interactable>
        </group>
      ))}
    </>
  )
}
