// Props that belong to the three cases (spec 10). Task 3.5: the safety-bell posts of minigame 1b,
// one beside each candidate grave, standing only once 1a is solved. Plain meshes and no lights, so
// they add a few draw calls and no shader cost. Using a post opens the 1b overlay on that post.
// Mount inside <Physics> (no colliders: a 6 cm post must never trap or snag the player).

import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import {
  CASE_1_BELLS,
  CASE_2_CASTS,
  CASE_2_CREST_LOCK,
  CASE_2_LOGBOOK_POSITION,
  CREST_GLYPHS,
  CREST_NAMES,
  caseOfStage,
  type CastDef,
  type ClueDef,
  type CrestTabletDef,
  CASE_3_CRYPT_PROPS,
  CASE_3_EVIDENCE,
  CASE_3_EVIDENCE_SPOTS,
  type BellPostDef,
  type EvidenceCardId,
} from '../../data/cases'
import { CHAPEL_CENTER, MAUSOLEUM_ROW, avenueCrypts } from '../../data/cemeteryLayout'
import { HYMN_BOARD_POSITION, HYMN_TILE_ROW, PSALTER_POSITION } from '../../data/chapelScenery'
import { ALTAR_WHISTLE_OFFSET } from '../../data/gateHints'
import { pullBellCord, type BellSound } from '../../game/state/case1Story'
import { playRecorded } from '../../audio/AudioManager'
import { useCaseStore } from '../../game/state/caseStore'
import { useClueRevealStore } from '../../game/state/clueRevealStore'
import { useMysteryStore } from '../../game/state/mysteryStore'
import { useOverlayStore } from '../../game/state/overlayStore'
import { useStageStore } from '../../game/state/stageStore'
import { useToastStore } from '../../game/state/toastStore'
import { useWorldStore } from '../../game/state/worldStore'
import { HYMN_TILE_COUNT } from '../../game/systems/caseSave'
import {
  BellPostShape,
  BootCastShape,
  CryptDoorShape,
  DialShape,
  EvidenceShape,
  HymnTileShape,
  LogbookShape,
  LoosePageShape,
  NichePierShape,
  PsalterShape,
  ShroudedBodyShape,
  SlateShape,
  TabletRivets,
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

const openTimeline = () => useOverlayStore.getState().setMinigameOpen('3b')

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
          useToastStore
            .getState()
            .push(`Evidence: ${CASE_3_EVIDENCE.find((e) => e.id === id)?.title ?? id}`)
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

/** The slate at the foot of the crypt step where the six cards are laid out. */
function TimelineSlate() {
  return (
    <group position={[...CASE_3_CRYPT_PROPS.slate]} rotation={[0, Math.PI / 2 - 0.3, 0]}>
      <Interactable
        id="timeline-slate"
        kind="timeline-slate"
        runeHeight={1.2}
        outlineRange={4}
        onInteract={openTimeline}
      >
        <SlateShape />
      </Interactable>
    </group>
  )
}

/**
 * The Crane crypt once the pin is pulled: a dark doorway, the door leaf swung back and Elias
 * lying in it (the Iron Ossuary Key is a fixed spawn that waits for 3b too). No collider, so the doorway never traps the player.
 */
function CryptOpened() {
  const { doorX, doorFaceZ, body } = CASE_3_CRYPT_PROPS
  return (
    <>
      <mesh position={[doorX, 1.0, doorFaceZ + 0.04]}>
        <boxGeometry args={[1.5, 2.0, 0.05]} />
        <meshStandardMaterial color="#050505" roughness={1} />
      </mesh>
      <group position={[doorX + 0.95, 1.0, doorFaceZ + 0.45]} rotation={[0, Math.PI / 2 - 0.4, 0]}>
        <CryptDoorShape />
      </group>
      <group position={[...body]} rotation={[0, 1.2, 0]}>
        <ShroudedBodyShape />
      </group>
    </>
  )
}

/**
 * Stage 3 crypt-side props: the evidence and the slate, day and night (the ossuary key behind 3b is
 * needed for the rite, so they cannot wait for a morning that never comes, spec 10 task 12.2); the
 * opened crypt stays once 3b is solved.
 */
function CryptProps() {
  const solved = useCaseStore((s) => s.cases['sealed-catacombs'].minigames.includes('3b'))
  const ids = Object.keys(CASE_3_EVIDENCE_SPOTS) as Exclude<EvidenceCardId, 'dry-boots'>[]
  return (
    <>
      {!solved && ids.map((id) => <EvidenceProp key={id} id={id} />)}
      <TimelineSlate />
      {solved && <CryptOpened />}
    </>
  )
}

// ---- Walk clues ----

/** Which look a walk clue takes. */
function walkLook(clue: ClueDef): WalkClueLook {
  if (clue.id === 'spade-fresh-clay') return 'spade'
  if (clue.id === 'hale-fresh-flowers') return 'posy'
  if (clue.id === 'oil-other-crypt') return 'oil'
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

// ---- Stage 2: The Resurrection Men (spec 10 task 5) ----

const openWatchLog = () => useOverlayStore.getState().setMinigameOpen('2b')
const openCrestLock = () => useOverlayStore.getState().setMinigameOpen('2a')

const LOOSE_PAGES: readonly (readonly [number, number, number])[] = [
  [0.2, -0.12, 0.5],
  [0.17, 0.02, -0.4],
  [-0.03, 0.22, 0.9],
]

/** The watch-house logbook on the lodge table, with torn pages loose beside it. */
function WatchLogbook() {
  return (
    <group position={[...CASE_2_LOGBOOK_POSITION]} rotation={[0, 0.25, 0]}>
      <Interactable
        id="watch-logbook"
        kind="watch-logbook"
        runeHeight={0.4}
        outlineRange={4}
        onInteract={openWatchLog}
      >
        <LogbookShape />
        {LOOSE_PAGES.map(([x, z, r], i) => (
          <group key={i} position={[x * 0.9 + 0.08, 0.001, z]} rotation={[0, r, 0]}>
            <LoosePageShape />
          </group>
        ))}
      </Interactable>
    </group>
  )
}

/** A canvas texture with a tablet's crest, family and year; made once per tablet. */
function useTabletTexture(t: CrestTabletDef): CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 160
    const g = canvas.getContext('2d')
    if (!g) return null
    g.fillStyle = '#6e675c'
    g.fillRect(0, 0, 256, 160)
    g.strokeStyle = '#2a2623'
    g.lineWidth = 6
    g.strokeRect(6, 6, 244, 148)
    g.fillStyle = '#1c1a17'
    g.textAlign = 'center'
    g.font = '48px "Segoe UI Symbol", serif'
    g.fillText(CREST_GLYPHS[t.crest], 128, 58)
    g.font = 'bold 34px Georgia, serif'
    g.fillText(t.family.toUpperCase(), 128, 104)
    g.font = '26px Georgia, serif'
    g.fillText('LAID DOWN ' + t.year, 128, 140)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [t])
}

/**
 * A crypt name tablet: an iron-framed plate on the avenue railing in front of its crypt, facing the
 * path at chest height. (The crypt fronts' own panel sits inside the door frame, where a plate is
 * hidden, so the name hangs on the railing gate instead.) Reading it says the year too.
 */
function CrestTablet({ t }: { t: CrestTabletDef }) {
  const crypt = avenueCrypts()[t.crypt]
  const tex = useTabletTexture(t)
  if (!crypt) return null
  const west = crypt.position[0] < MAUSOLEUM_ROW.centerX
  const x = MAUSOLEUM_ROW.centerX + (west ? -1 : 1) * (MAUSOLEUM_ROW.width / 2 - 0.06)
  const line =
    t.family +
    '. The ' +
    CREST_NAMES[t.crest].toLowerCase() +
    ' crest. The founder laid down in ' +
    t.year +
    '.'
  return (
    <group
      position={[x, 1.15, crypt.position[2]]}
      rotation={[0, west ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <Interactable
        id={'crest-tablet-' + t.family}
        kind="crest-tablet"
        subject={t.family}
        runeHeight={0.4}
        outlineRange={6}
        onInteract={() => {
          useCaseStore.getState().readTablet(t.family)
          useClueRevealStore.getState().revealPlain(line)
        }}
      >
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[0.6, 0.38, 0.02]} />
          <meshStandardMaterial color="#2a2623" roughness={0.8} metalness={0.5} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.56, 0.35]} />
          <meshStandardMaterial map={tex ?? undefined} roughness={0.95} />
        </mesh>
        <TabletRivets />
      </Interactable>
    </group>
  )
}

/** The sexton's niche: a stone pier with four crest dials facing the avenue. Dark inside once solved. */
function CrestNiche() {
  const solved = useCaseStore((s) => s.cases['resurrection-men'].minigames.includes('2a'))
  const dials = useCaseStore((s) => s.cases['resurrection-men'].crestDials)
  const [x, , z] = CASE_2_CREST_LOCK.niche
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <Interactable
        id="crest-lock"
        kind="crest-lock"
        runeHeight={1.5}
        outlineRange={4}
        onInteract={openCrestLock}
      >
        <NichePierShape />
        <mesh position={[0, 0.45, 0.06]}>
          <boxGeometry args={[0.4, 0.3, 0.02]} />
          <meshStandardMaterial color={solved ? '#050505' : '#5d574d'} roughness={1} />
        </mesh>
        {dials.map((d, i) => (
          <group key={i} position={[-0.24 + i * 0.16, 0.95, 0.06]}>
            <DialShape glow={solved ? 0.5 : d ? 0.15 : 0} />
          </group>
        ))}
      </Interactable>
    </group>
  )
}

/** One plaster cast in front of the Ames stone, its print drawn from the cast's details. */
function BootCast({ cast }: { cast: CastDef }) {
  return (
    <group position={[...cast.position]} rotation={[0, 0.2, 0]}>
      <Interactable
        id={'boot-cast-' + cast.id}
        kind="boot-cast"
        subject={cast.id}
        runeHeight={0.5}
        outlineRange={4}
        onInteract={() => {
          useOverlayStore.getState().setCastFocus(cast.id)
          useOverlayStore.getState().setMinigameOpen('2c')
        }}
      >
        <BootCastShape cast={cast} />
        <mesh visible={false} position={[0, 0.12, 0]}>
          <boxGeometry args={[0.35, 0.25, 0.45]} />
        </mesh>
      </Interactable>
    </group>
  )
}

/** Stage 2 props: the logbook and casts by day; the niche and the crypt tablets always (the niche stays open). */
function ResurrectionProps() {
  const day = useWorldStore((s) => s.phase === 'day')
  return (
    <>
      {day && <WatchLogbook />}
      <CrestNiche />
      {CASE_2_CREST_LOCK.tablets.map((t) => (
        <CrestTablet key={t.family} t={t} />
      ))}
      {day && CASE_2_CASTS.map((c) => <BootCast key={c.id} cast={c} />)}
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
