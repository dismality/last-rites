// Environmental clues: small props the player can examine to record a clue.
// Rules (ledger required or not) live in the mystery store; this only draws and wires them.
import { Clone, useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { DRACO_PATH, clueModelUrl } from '../../data/assets'
import { NOTICE_POST_BOXES } from '../../data/propScenery'
import '../assets/preloadModels'
import { CLUE_SPOTS, type ClueSpot } from '../../data/tombstones'
import { pushJournalAddedToast } from '../../game/state/journalToast'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useToastStore } from '../../game/state/toastStore'
import { canDiscoverClue } from '../../game/systems/tombstones'
import { useInventoryStore } from '../../game/state/inventoryStore'
import { Interactable } from './Interactable'

/** The clue's outline fades in inside this distance (spec 09 task 11o). */
const CLUE_OUTLINE_RANGE_M = 4

function examineSpot(spot: ClueSpot): void {
  if (!canDiscoverClue(spot.clueId, useInventoryStore.getState().inventory)) {
    useToastStore.getState().push('The entries mean nothing without the parish ledger to compare.')
    return
  }
  useMysteryStore.getState().discoverClue(spot.clueId)
}

/**
 * A clue's own model (props/clue-<clueId>.glb, clue-local). All nine clues have one, so the three
 * generic shapes are gone. The outline hull follows these meshes (Interactable).
 */
function Prop({ clueId }: { clueId: ClueSpot['clueId'] }) {
  const model = useGLTF(clueModelUrl(clueId), DRACO_PATH).scene
  return <Clone object={model} />
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
            <Prop clueId={spot.clueId} />
          </Interactable>
          {/* The notice post is solid (clue-ledger-week.json); the other clue props are low and walked around. */}
          {spot.clueId === 'clue-ledger-week' && (
            <RigidBody type="fixed" colliders={false}>
              {NOTICE_POST_BOXES.map((b) => (
                <CuboidCollider
                  key={b.note}
                  args={[b.half[0], b.half[1], b.half[2]]}
                  position={[...b.center]}
                  rotation={[0, b.rotY, 0]}
                />
              ))}
            </RigidBody>
          )}
        </group>
      ))}
    </>
  )
}
