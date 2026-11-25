// Props that belong to the three cases (spec 10). Task 3.5: the safety-bell posts of minigame 1b,
// one beside each candidate grave, standing only once 1a is solved. Plain meshes and no lights, so
// they add a few draw calls and no shader cost. Using a post opens the 1b overlay on that post.
// Mount inside <Physics> (no colliders: a 6 cm post must never trap or snag the player).

import {
  CASE_1_BELLS,
  CASE_2_BOOTS_POSITION,
  CASE_2_FRESH_GRAVES,
  CASE_2_LOCKER_POSITION,
  CASE_2_LOGBOOK_POSITION,
  CASE_2_PRINT,
  CASE_2_PRINT_POSITION,
  CASE_2_REGISTER_POSITION,
  caseOfStage,
  type ClueDef,
  type FreshGraveDef,
  CASE_3_CRYPT_PROPS,
  CASE_3_RUTS,
  type BellPostDef,
} from '../../data/cases'
import { CHAPEL_CENTER } from '../../data/cemeteryLayout'
import { HYMN_BOARD_POSITION, HYMN_TILE_ROW, PSALTER_POSITION } from '../../data/chapelScenery'
import { ALTAR_WHISTLE_OFFSET } from '../../data/gateHints'
import { pullBellCord, type BellSound } from '../../game/state/case1Story'
import { inspectFreshGrave, takeBootPrint } from '../../game/state/case2Story'
import { pullCryptPin, searchElias } from '../../game/state/case3Story'
import { narrate } from '../../game/state/narrationStore'
import { CASE2_SAY } from '../../data/case2Narration'
import { playRecorded } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useStageStore } from '../../game/state/stageStore'
import { useWorldStore } from '../../game/state/worldStore'
import { HYMN_TILE_COUNT } from '../../game/systems/caseSave'
import {
  BellPostShape,
  BootCastShape,
  BootPairShape,
  CryptDoorShape,
  FreshGraveShape,
  HearsePinShape,
  HymnTileShape,
  LockerShape,
  LogbookShape,
  NailMarksShape,
  PsalterShape,
  RutsShape,
  SlumpedBodyShape,
  WalkClueShape,
  type WalkClueLook,
} from './caseShapes'
import { Interactable } from './Interactable'

const POST_HEIGHT = 1.1

/** A sound bell rings where it stands; a cut cord gives no sound at all. */
const ringBell: BellSound = (id, rings) => {
  const post = CASE_1_BELLS.find((p) => p.id === id)
  if (!post || !rings) return
  const [x, , z] = post.position
  playRecorded('strange-hand-bell', { x, y: POST_HEIGHT, z }, 0.9, 30, 'ambience')
}

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
        onInteract={() => pullBellCord(post.id, ringBell)}
      >
        <BellPostShape height={POST_HEIGHT} cut={cut} />
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
      <Interactable
        id="hymn-board"
        kind="hymn-board"
        runeHeight={0.6}
        outlineRange={4}
        onInteract={openHymnBoard}
      >
        <mesh visible={false}>
          <boxGeometry args={[0.3, 0.8, 1.5]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** The psalter: a small closed book on the vestry cupboard shelf. Leather, pages and brass, no lights. */
function Psalter() {
  return (
    <group position={[...PSALTER_POSITION]} rotation={[0, 0.5, 0]}>
      <Interactable id="psalter" kind="psalter" runeHeight={0.3} onInteract={openHymnBoard}>
        <PsalterShape />
      </Interactable>
    </group>
  )
}

/**
 * Five brass letter tiles on the altar top. A tile with a letter set glows ember (emissive, no
 * light) so progress reads from the world as well as the overlay. They vanish as the stair opens
 * and the altar slides. The letters themselves are shown in the overlay.
 */
function HymnTiles() {
  const tiles = useCaseStore((s) => s.cases['sealed-catacombs'].hymnTiles)
  const [cx, , cz] = CHAPEL_CENTER
  const start = -((HYMN_TILE_COUNT - 1) / 2) * HYMN_TILE_ROW.spacing
  return (
    <group position={[cx, HYMN_TILE_ROW.y, cz + ALTAR_WHISTLE_OFFSET[2] + HYMN_TILE_ROW.forward]}>
      {Array.from({ length: HYMN_TILE_COUNT }, (_, i) => (
        <group key={i} position={[start + i * HYMN_TILE_ROW.spacing, 0, 0]}>
          <HymnTileShape lit={Boolean(tiles[i])} />
        </group>
      ))}
    </group>
  )
}

/**
 * Stage 3 chapel props, day and night (3a solved props idle but stay). The story night lasts until
 * the rite, and the rite needs the heart behind the stair, so the board must not vanish at dusk
 * (spec 10 task 12.2: a Short Vigil day is too short to finish 3a and 3b).
 */
function HymnProps() {
  const sealed = useMysteryStore((s) => !s.mystery.gates.catacombs)
  return (
    <>
      <HymnBoardHotspot />
      <Psalter />
      {sealed && <HymnTiles />}
    </>
  )
}

// ---- Stage 3 on the Row: the cart ruts, the pinned Crane crypt door, Elias (playtest story pass) ----

/** The hearse cart's ruts, from just inside the Row gate down the avenue to the Crane crypt step. */
function CartRuts() {
  const { wheels, fromZ, toZ } = CASE_3_RUTS
  const gauge = wheels[1] - wheels[0]
  return (
    <group position={[(wheels[0] + wheels[1]) / 2, 0, fromZ]}>
      <RutsShape length={fromZ - toZ} gauge={gauge} />
    </group>
  )
}

/** The iron hearse pin through the door's two hasps, pushed in from outside. Pulling it is 3b. */
function HearsePin() {
  return (
    <group position={[...CASE_3_CRYPT_PROPS.pin]}>
      <Interactable id="crypt-pin" kind="crypt-pin" runeHeight={0.4} outlineRange={4} onInteract={pullCryptPin}>
        <HearsePinShape />
        {/* A thin bar is hard to aim at, so a hidden box gives the crosshair something to land on. */}
        <mesh visible={false}>
          <boxGeometry args={[0.55, 0.2, 0.2]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** The open doorway's width (m), how far in front of the crypt front it is drawn, and the leaf's swing (rad). */
const OPEN_DOORWAY_W = 1.2
const OPEN_DOORWAY_PROUD_M = 0.2
const DOOR_SWING = 2.0

/**
 * The Crane crypt once the pin is pulled: a dark doorway, the door leaf swung back with the
 * fingernail marks on its inner face, and Elias slumped in the doorway. No collider, so the
 * doorway never traps the player.
 */
function CryptOpened() {
  const { doorX, doorFaceZ, body } = CASE_3_CRYPT_PROPS
  // The crypt's own door sits a little proud of its front, so the open doorway is drawn just in front.
  const openZ = doorFaceZ + OPEN_DOORWAY_PROUD_M
  const hingeX = doorX + OPEN_DOORWAY_W / 2
  const half = OPEN_DOORWAY_W / 2
  return (
    <>
      <mesh position={[doorX, 1.0, openZ]}>
        <boxGeometry args={[OPEN_DOORWAY_W, 2.05, 0.04]} />
        {/* Unlit, so no lantern brightens the dark inside. */}
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* The leaf swung out about its right-hand hinge, so its scratched inner face turns to the avenue. */}
      <group
        position={[hingeX - half * Math.cos(DOOR_SWING), 1.0, openZ + half * Math.sin(DOOR_SWING)]}
        rotation={[0, DOOR_SWING, 0]}
        scale={[OPEN_DOORWAY_W / 0.8, 1.03, 1.4]}
      >
        <CryptDoorShape />
        <group position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]} scale={[0.8 / OPEN_DOORWAY_W, 1, 1]}>
          <NailMarksShape />
        </group>
      </group>
      <group position={[body[0], body[1], body[2] - 0.7]}>
        <Interactable id="elias" kind="elias" runeHeight={1.1} outlineRange={4} onInteract={searchElias}>
          <SlumpedBodyShape />
        </Interactable>
      </group>
    </>
  )
}

/** Stage 3 on the Row, day and night: the ruts always; the pin until it is pulled, then the open crypt. */
function CryptProps() {
  const open = useCaseStore((s) => s.cases['sealed-catacombs'].minigames.includes('3b'))
  return (
    <>
      <CartRuts />
      {open ? <CryptOpened /> : <HearsePin />}
    </>
  )
}

// ---- Walk clues ----

/** Which look a walk clue takes. */
function walkLook(clue: ClueDef): WalkClueLook {
  if (clue.id === 'spade-fresh-clay') return 'spade'
  if (clue.id === 'hale-fresh-flowers') return 'posy'
  if (clue.id === 'oil-other-crypt') return 'oil'
  if (clue.id === 'hearse-cart-ruts') return 'ruts'
  if (clue.icon === 'read') return 'note'
  return 'bundle'
}

type WalkClueDef = ClueDef & { found: { kind: 'walk' } }

const isWalkClue = (c: ClueDef): c is WalkClueDef => c.found.kind === 'walk'

function WalkClue({ clue }: { clue: WalkClueDef }) {
  return (
    <group position={[...clue.found.position]}>
      <Interactable
        id={`case-clue-${clue.id}`}
        kind="case-clue"
        subject={clue.id}
        runeHeight={0.6}
        outlineRange={4}
        onInteract={() => {
          useCaseStore.getState().findClue(clue.id)
        }}
      >
        <WalkClueShape look={walkLook(clue)} />
        {/* A flat prop is thin, so a hidden box gives the crosshair something to land on. */}
        <mesh visible={false} position={[0, 0.12, 0]}>
          <boxGeometry args={[0.45, 0.3, 0.45]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** Clues found by walking to them (the cases' walk sources): the active stage's case only, by day, until found. */
function WalkClues({ stage }: { stage: 1 | 2 | 3 }) {
  const c = caseOfStage(stage)
  const found = useCaseStore((s) => s.cases[c.id].found)
  const day = useWorldStore((s) => s.phase === 'day')
  if (!day) return null
  return (
    <>
      {c.clues
        .filter(isWalkClue)
        .filter((k) => !found.includes(k.id))
        .map((k) => (
          <WalkClue key={k.id} clue={k} />
        ))}
    </>
  )
}

// ---- Stage 2: The Resurrection Men (playtest story pass) ----
// Three fresh graves by the lodge; on the lodge table the burial register and the watch log; the
// print at the robbed grave; three pairs of boots and Kerr's crest-locked locker by the table.

const open2 = (id: '2a' | '2b' | '2c' | '2d') => () => useOverlayStore.getState().setMinigameOpen(id)
const caseTwo = () => useCaseStore.getState().cases['resurrection-men']

/** A fresh grave: looking at it says what it shows. The robbed one is dug open with clay round it. */
function FreshGrave({ g }: { g: FreshGraveDef }) {
  return (
    <group position={[...g.position]}>
      <Interactable
        id={`fresh-grave-${g.id}`}
        kind="fresh-grave"
        subject={g.id}
        runeHeight={1.0}
        outlineRange={5}
        onInteract={() => inspectFreshGrave(g.id)}
      >
        <FreshGraveShape robbed={g.robbed} />
      </Interactable>
    </group>
  )
}

/** A book lying open on the lodge table: the register (2a) or the watch log (2b). */
function LodgeBook({ id, at, open }: { id: 'burial-register' | 'watch-logbook'; at: readonly [number, number, number]; open: () => void }) {
  return (
    <group position={[...at]} rotation={[0, id === 'burial-register' ? -0.2 : 0.25, 0]}>
      {id === 'burial-register' ? (
        <Interactable id="burial-register" kind="burial-register" runeHeight={0.4} outlineRange={4} onInteract={open}>
          <LogbookShape />
        </Interactable>
      ) : (
        <Interactable id="watch-logbook" kind="watch-logbook" runeHeight={0.4} outlineRange={4} onInteract={open}>
          <LogbookShape />
        </Interactable>
      )}
    </group>
  )
}

/** The print set in plaster at the foot of the robbed grave. Taking it sketches it into the journal. */
function BootPrint() {
  return (
    <group position={[...CASE_2_PRINT_POSITION]} rotation={[0, 0.2, 0]}>
      <Interactable id="boot-print" kind="boot-cast" runeHeight={0.5} outlineRange={4} onInteract={takeBootPrint}>
        <BootCastShape sole={CASE_2_PRINT} />
        <mesh visible={false} position={[0, 0.12, 0]}>
          <boxGeometry args={[0.35, 0.25, 0.45]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** The three pairs of boots by the lodge table: the visitor's, Dale's and Kerr's, left to right. */
function LodgeBoots() {
  const open = () => {
    if (!caseTwo().printTaken) return narrate(CASE2_SAY.bootsNoPrint)
    open2('2c')()
  }
  return (
    <group position={[...CASE_2_BOOTS_POSITION]}>
      <Interactable id="lodge-boots" kind="boot-pair" runeHeight={0.6} outlineRange={4} onInteract={open}>
        <group position={[-0.4, 0, 0]}>
          <BootPairShape narrow clay={false} />
        </group>
        <BootPairShape narrow={false} clay={false} />
        <group position={[0.4, 0, 0]}>
          <BootPairShape narrow={false} clay />
        </group>
        <mesh visible={false} position={[0, 0.15, 0]}>
          <boxGeometry args={[1.2, 0.3, 0.4]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** Kerr's locker. It opens the crest lock (2d) only once the boots have given up its key. */
function KerrsLocker() {
  const solved = useCaseStore((s) => s.cases['resurrection-men'].minigames.includes('2d'))
  const open = () => {
    if (!caseTwo().minigames.includes('2c')) return narrate(CASE2_SAY.lockerNoKey)
    open2('2d')()
  }
  return (
    <group position={[...CASE_2_LOCKER_POSITION]} rotation={[0, Math.PI / 2, 0]}>
      <Interactable id="crest-lock" kind="crest-lock" runeHeight={1.6} outlineRange={4} onInteract={open}>
        <LockerShape open={solved} />
      </Interactable>
    </group>
  )
}

/** Stage 2 props, day and night (the graves are scenery; the lodge things wait for the player). */
function ResurrectionProps() {
  return (
    <>
      {CASE_2_FRESH_GRAVES.map((g) => (
        <FreshGrave key={g.id} g={g} />
      ))}
      <LodgeBook id="burial-register" at={CASE_2_REGISTER_POSITION} open={open2('2a')} />
      <LodgeBook id="watch-logbook" at={CASE_2_LOGBOOK_POSITION} open={open2('2b')} />
      <BootPrint />
      <LodgeBoots />
      <KerrsLocker />
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
      <WalkClues stage={stage} />
      {stage === 2 && <ResurrectionProps />}
      {stage === 3 && <HymnProps />}
      {stage === 3 && <CryptProps />}
    </group>
  )
}
