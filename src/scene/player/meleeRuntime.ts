// Per-frame values shared between the melee driver, viewmodel, camera and dust.
// Mutable refs rather than store state: they change every frame and nothing
// outside the scene layer reads them.
import { REST_POSE, type DustParticle, type SwingPose } from '../../game/systems/melee'

export const meleeRuntime = {
  /** Current swing pose applied by the Viewmodel. */
  pose: REST_POSE as SwingPose,
  /** Seconds since the last shaking hit; Infinity = idle. */
  shakeAge: Infinity,
  /** Particles waiting to be picked up by DustBurst. */
  dustQueue: [] as DustParticle[],
}
