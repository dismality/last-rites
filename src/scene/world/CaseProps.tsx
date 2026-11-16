// Props that belong to the three cases (spec 10). Task 3.5: the safety-bell posts of minigame 1b,
// one beside each candidate grave, standing only once 1a is solved. Plain meshes and no lights, so
// they add a few draw calls and no shader cost. Using a post opens the 1b overlay on that post.
// Mount inside <Physics> (no colliders: a 6 cm post must never trap or snag the player).

import { CASE_1_BELLS, type BellPostDef } from '../../data/cases'
import { useCaseStore } from '../../game/state/caseStore'
import { useOverlayStore } from '../../game/state/overlayStore'
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

/** The bell posts stand only after the ledger is cross-checked (1a), so day 1 starts uncluttered. */
export function CaseProps() {
  const ledgerSolved = useCaseStore((s) => s.cases['saved-by-the-bell'].minigames.includes('1a'))
  if (!ledgerSolved) return null
  return (
    <group name="case-props">
      {CASE_1_BELLS.map((p) => (
        <BellPost key={p.id} post={p} />
      ))}
    </group>
  )
}
