// Props that belong to the three cases (spec 10). Task 3.5: the safety-bell posts of minigame 1b,
// one beside each candidate grave, standing only once 1a is solved. Plain meshes and no lights, so
// they add a few draw calls and no shader cost. Using a post opens the 1b overlay on that post.
// Mount inside <Physics> (no colliders: a 6 cm post must never trap or snag the player).

import {
  CASE_1_BELLS,
  CASE_3_CRYPT_PROPS,
  CASE_3_EVIDENCE,
  CASE_3_EVIDENCE_SPOTS,
  type BellPostDef,
  type EvidenceCardId,
} from '../../data/cases'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { HYMN_BOARD_POSITION, HYMN_TILE_ROW, PSALTER_POSITION } from '../../data/chapelScenery'
import { ALTAR_WHISTLE_OFFSET } from '../../data/gateHints'
import { useCaseStore } from '../../game/state/caseStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useStageStore } from '../../game/state/stageStore'
import { useToastStore } from '../../game/state/toastStore'
import { useWorldStore } from '../../game/state/worldStore'
import { HYMN_TILE_COUNT } from '../../game/systems/caseSave'
import { Interactable } from './Interactable'

const POST_HEIGHT = 1.1

/** An iron post with a bell at the top, a rope hanging from it and a paper tag. */
function BellPost({ post }: { post: BellPostDef }) {
  const cut = post.condition === 'rope-cut'
  return (
    <group position={[...post.position]}>
      <Interactable
        id={post.id}
        kind="bell-post"
        subject={post.id}
        runeHeight={POST_HEIGHT + 0.5}
        outlineRange={4}
        onInteract={() => {
          useOverlayStore.getState().setBellPostFocus(post.id)
          useOverlayStore.getState().setMinigameOpen('1b')
        }}
      >
        <mesh position={[0, POST_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.04, POST_HEIGHT, 6]} />
          <meshStandardMaterial color="#2a2623" roughness={0.9} metalness={0.4} />
        </mesh>
        <mesh position={[0, POST_HEIGHT + 0.1, 0]}>
          <coneGeometry args={[0.13, 0.2, 8]} />
          <meshStandardMaterial color="#6b5a3a" roughness={0.7} metalness={0.5} />
        </mesh>
        {/* A cut rope hangs short, a whole one reaches the ground. */}
        <mesh position={[0.06, POST_HEIGHT - (cut ? 0.2 : 0.5), 0]}>
          <cylinderGeometry args={[0.012, 0.012, cut ? 0.4 : 1, 5]} />
          <meshStandardMaterial color="#8a7a5a" roughness={1} />
        </mesh>
        <mesh position={[-0.05, POST_HEIGHT - 0.25, 0.04]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.1, 0.13, 0.01]} />
          <meshStandardMaterial color="#c9b88f" roughness={1} />
        </mesh>
      </Interactable>
    </group>
  )
}

const openHymnBoard = () => useOverlayStore.getState().setMinigameOpen('3a')

/**
 * The hymn board hangs on the chapel's east wall and is painted in the chapel model, so only an
 * invisible hit box is mounted here. PLACEHOLDER: the real plaque model is art still to come.
 */
function HymnBoardHotspot() {
  return (
    <group position={[...HYMN_BOARD_POSITION]}>
      <Interactable id="hymn-board" kind="hymn-board" runeHeight={0.6} outlineRange={4} onInteract={openHymnBoard}>
        <mesh visible={false}>
          <boxGeometry args={[0.3, 0.8, 1.5]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** The psalter: a small closed book on the vestry cupboard shelf. PLACEHOLDER box meshes, no lights. */
function Psalter() {
  return (
    <group position={[...PSALTER_POSITION]} rotation={[0, 0.5, 0]}>
      <Interactable id="psalter" kind="psalter" runeHeight={0.3} onInteract={openHymnBoard}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.28]} />
          <meshStandardMaterial color="#3b2a22" roughness={0.9} />
        </mesh>
        <mesh position={[0.005, 0.03, 0]}>
          <boxGeometry args={[0.2, 0.045, 0.26]} />
          <meshStandardMaterial color="#c9b88f" roughness={1} />
        </mesh>
      </Interactable>
    </group>
  )
}

/**
 * Five brass letter tiles on the altar top. A tile with a letter set glows ember (emissive, no
 * light) so progress reads from the world as well as the overlay. They vanish as the stair opens
 * and the altar slides. PLACEHOLDER: plain brass boxes, the lettered tile model is art still to come.
 */
function HymnTiles() {
  const tiles = useCaseStore((s) => s.cases['sealed-catacombs'].hymnTiles)
  const [cx, , cz] = CHAPEL_CENTER
  const start = -((HYMN_TILE_COUNT - 1) / 2) * HYMN_TILE_ROW.spacing
  return (
    <group position={[cx, HYMN_TILE_ROW.y, cz + ALTAR_WHISTLE_OFFSET[2] + HYMN_TILE_ROW.forward]}>
      {Array.from({ length: HYMN_TILE_COUNT }, (_, i) => (
        <mesh key={i} position={[start + i * HYMN_TILE_ROW.spacing, 0, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.18]} />
          <meshStandardMaterial
            color="#a8832f"
            roughness={0.5}
            metalness={0.7}
            emissive="#e8913a"
            emissiveIntensity={tiles[i] ? 0.6 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Stage 3 chapel props: by day, until the stair is open (3a solved props idle but stay). */
function HymnProps() {
  const day = useWorldStore((s) => s.phase === 'day')
  const sealed = useMysteryStore((s) => !s.mystery.gates.catacombs)
  return (
    <>
      {day && <HymnBoardHotspot />}
      {day && <Psalter />}
      {sealed && <HymnTiles />}
    </>
  )
}

const openTimeline = () => useOverlayStore.getState().setMinigameOpen('3b')

/** Meshes of each evidence prop. PLACEHOLDER: plain boxes and cylinders, the modelled props are art still to come. */
function EvidenceShape({ id }: { id: Exclude<EvidenceCardId, 'dry-boots'> }) {
  switch (id) {
    case 'unsent-letter':
      return (
        <mesh rotation={[0, 0.5, 0]}>
          <boxGeometry args={[0.2, 0.01, 0.14]} />
          <meshStandardMaterial color="#d8c9a3" roughness={1} />
        </mesh>
      )
    case 'cart-ruts':
      return (
        <>
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.22, 2.4]} />
              <meshStandardMaterial color="#1d1813" roughness={1} />
            </mesh>
          ))}
        </>
      )
    case 'spilled-oil':
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.42, 14]} />
          <meshStandardMaterial color="#14110f" roughness={0.3} metalness={0.3} />
        </mesh>
      )
    case 'hearse-pin':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <meshStandardMaterial color="#2a2623" roughness={0.8} metalness={0.6} />
        </mesh>
      )
    case 'nail-marks':
      return (
        <>
          {[-0.1, 0, 0.1].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.025, 0.4, 0.01]} />
              <meshStandardMaterial color="#c9b88f" roughness={1} />
            </mesh>
          ))}
        </>
      )
  }
}

/** One piece of Elias's last night. Examining it puts its card in hand for minigame 3b. */
function EvidenceProp({ id }: { id: Exclude<EvidenceCardId, 'dry-boots'> }) {
  const spot = CASE_3_EVIDENCE_SPOTS[id]
  return (
    <group position={[...spot.position]}>
      <Interactable
        id={`evidence-${id}`}
        kind="evidence-card"
        subject={id}
        runeHeight={0.5}
        outlineRange={4}
        onInteract={() => {
          if (!useCaseStore.getState().findEvidence(id)) return
          useToastStore.getState().push(`Evidence: ${CASE_3_EVIDENCE.find((e) => e.id === id)?.title ?? id}`)
        }}
      >
        <EvidenceShape id={id} />
        {/* A flat prop is thin, so a hidden box gives the crosshair something to land on. */}
        <mesh visible={false} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.5]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** The slate at the foot of the crypt step where the six cards are laid out. PLACEHOLDER box meshes. */
function TimelineSlate() {
  return (
    <group position={[...CASE_3_CRYPT_PROPS.slate]} rotation={[0, Math.PI / 2 - 0.3, 0]}>
      <Interactable id="timeline-slate" kind="timeline-slate" runeHeight={1.2} outlineRange={4} onInteract={openTimeline}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.8, 6]} />
          <meshStandardMaterial color="#2a2623" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.9, 0]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[0.7, 0.45, 0.04]} />
          <meshStandardMaterial color="#3a342d" roughness={0.9} />
        </mesh>
      </Interactable>
    </group>
  )
}

/**
 * The Crane crypt once the pin is pulled: a dark doorway, the door leaf swung back and Elias
 * lying in it (the Iron Ossuary Key is a fixed spawn that waits for 3b too). PLACEHOLDER shapes: a
 * modelled door and body are art still to come. No collider, so the doorway never traps the player.
 */
function CryptOpened() {
  const { doorX, doorFaceZ, body } = CASE_3_CRYPT_PROPS
  return (
    <>
      <mesh position={[doorX, 1.0, doorFaceZ + 0.04]}>
        <boxGeometry args={[1.5, 2.0, 0.05]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
      <mesh position={[doorX + 0.95, 1.0, doorFaceZ + 0.45]} rotation={[0, Math.PI / 2 - 0.4, 0]}>
        <boxGeometry args={[0.8, 1.95, 0.06]} />
        <meshStandardMaterial color="#3b2a22" roughness={0.9} />
      </mesh>
      <group position={[...body]} rotation={[0, 1.2, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[1.4, 0.18, 0.5]} />
          <meshStandardMaterial color="#4a4036" roughness={1} />
        </mesh>
        <mesh position={[0.78, 0.12, 0]}>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshStandardMaterial color="#9a8a74" roughness={1} />
        </mesh>
      </group>
    </>
  )
}

/** Stage 3 crypt-side props: by day the evidence and the slate; the opened crypt stays once 3b is solved. */
function CryptProps() {
  const day = useWorldStore((s) => s.phase === 'day')
  const solved = useCaseStore((s) => s.cases['sealed-catacombs'].minigames.includes('3b'))
  const ids = Object.keys(CASE_3_EVIDENCE_SPOTS) as Exclude<EvidenceCardId, 'dry-boots'>[]
  return (
    <>
      {day && !solved && ids.map((id) => <EvidenceProp key={id} id={id} />)}
      {day && <TimelineSlate />}
      {solved && <CryptOpened />}
    </>
  )
}
/** The bell posts stand only after the ledger is cross-checked (1a), so day 1 starts uncluttered. */
export function CaseProps() {
  const ledgerSolved = useCaseStore((s) => s.cases['saved-by-the-bell'].minigames.includes('1a'))
  const stage = useStageStore((s) => s.stage)
  return (
    <group name="case-props">
      {ledgerSolved && CASE_1_BELLS.map((p) => <BellPost key={p.id} post={p} />)}
      {stage === 3 && <HymnProps />}
      {stage === 3 && <CryptProps />}
    </group>
  )
}
