import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { GRAB_CAPTION, KILL_CAM } from '../../data/killCam'
import { CAPTIONS } from '../../data/captions'
import { SOUND_IDS } from '../../data/sounds'
import type { EnemyId } from '../../data/enemies'
import {
  angleDelta,
  attemptGrab,
  cooledDown,
  edgeOpacity,
  grabPose,
  grabTriggers,
  isFacing,
  lookAt,
  planGrab,
  type KillCamState,
} from './killCam'

const MAX = 100
const base = { enemy: 'brute' as EnemyId, health: 20, maxHealth: MAX, stamina: 50, facing: true }

describe('grabTriggers (Req 25.1)', () => {
  it('a Brute or Lurker blow below 25% health seizes, facing or not', () => {
    expect(grabTriggers(base)).toBe(true)
    expect(grabTriggers({ ...base, enemy: 'lurker', facing: false })).toBe(true)
  })
  it('other zombies never seize', () => {
    for (const enemy of ['shambler', 'wailer', 'bloater', 'father-crane'] as EnemyId[]) {
      expect(grabTriggers({ ...base, enemy })).toBe(false)
    }
  })
  it('at 25% health or more it needs empty stamina and the zombie behind', () => {
    const healthy = { ...base, health: 25 }
    expect(grabTriggers(healthy)).toBe(false)
    expect(grabTriggers({ ...healthy, stamina: 0, facing: true })).toBe(false)
    expect(grabTriggers({ ...healthy, stamina: 0, facing: false })).toBe(true)
    expect(grabTriggers({ ...healthy, stamina: 1, facing: false })).toBe(false)
  })
  it('a dead keeper is never seized', () => {
    expect(grabTriggers({ ...base, health: 0 })).toBe(false)
  })
})

describe('isFacing', () => {
  it('ahead is facing, behind and beside are not', () => {
    // Yaw 0 looks down -Z.
    expect(isFacing({ x: 0, z: 0 }, 0, { x: 0, z: -2 })).toBe(true)
    expect(isFacing({ x: 0, z: 0 }, 0, { x: 0, z: 2 })).toBe(false)
    expect(isFacing({ x: 0, z: 0 }, 0, { x: 2, z: 0 })).toBe(false)
    expect(isFacing({ x: 0, z: 0 }, Math.PI, { x: 0, z: 2 })).toBe(true)
  })
})

describe('planGrab (Req 25.3-25.7, 29.1)', () => {
  const p = { cameraShake: true, flashingLights: true, reducedMotion: false, lethal: false }
  it('Full: the 1.2 s close-up, stinger and shake', () => {
    expect(planGrab({ ...p, intensity: 'full' })).toMatchObject({
      pull: true,
      holdS: KILL_CAM.fullS,
      stinger: 'grab-stinger',
      shake: true,
      closeUp: true,
      edge: 'flash',
      forceCaption: false,
    })
  })
  it('Reduced: shorter, the quiet stinger, no shake', () => {
    const r = planGrab({ ...p, intensity: 'reduced' })
    expect(r).toMatchObject({ pull: true, stinger: 'grab-stinger-soft', shake: false })
    expect(r.holdS).toBeLessThan(KILL_CAM.fullS)
  })
  it('Off: no camera, no stinger; the edge and a forced subtitle', () => {
    expect(planGrab({ ...p, intensity: 'off' })).toMatchObject({
      pull: false,
      holdS: 0,
      stinger: null,
      shake: false,
      closeUp: false,
      forceCaption: true,
    })
  })
  it('Flashing lights off gives a steady edge', () => {
    expect(planGrab({ ...p, intensity: 'full', flashingLights: false }).edge).toBe('steady')
    expect(planGrab({ ...p, intensity: 'off', flashingLights: false }).edge).toBe('steady')
  })
  it('Camera shake off or reduced motion: no shake; reduced motion also drops the lean-in', () => {
    expect(planGrab({ ...p, intensity: 'full', cameraShake: false }).shake).toBe(false)
    const rm = planGrab({ ...p, intensity: 'full', reducedMotion: true })
    expect(rm).toMatchObject({ shake: false, closeUp: false, pull: true })
  })
  it('a lethal blow plays the full close-up at Reduced, and still never moves the camera at Off', () => {
    const r = planGrab({ ...p, intensity: 'reduced', lethal: true })
    expect(r).toMatchObject({ pull: true, holdS: KILL_CAM.fullS, stinger: 'grab-stinger', shake: false })
    expect(planGrab({ ...p, intensity: 'off', lethal: true }).pull).toBe(false)
  })
})

describe('Property 21: Kill-cam cooldown and intensity', () => {
  // Validates Req 25.1, 25.2, 25.5, 25.7.
  const attempt = fc.record({
    gapS: fc.double({ min: 0, max: 90, noNaN: true }),
    enemy: fc.constantFrom<EnemyId>('shambler', 'lurker', 'wailer', 'bloater', 'brute'),
    health: fc.integer({ min: 1, max: MAX }),
    stamina: fc.integer({ min: 0, max: 100 }),
    facing: fc.boolean(),
    damage: fc.integer({ min: 1, max: 60 }),
    intensity: fc.constantFrom('full' as const, 'reduced' as const, 'off' as const),
  })

  it('starts are 60 s apart, Off never pulls the camera, and the grab adds no damage', () => {
    fc.assert(
      fc.property(fc.array(attempt, { maxLength: 40 }), (seq) => {
        let state: KillCamState = { lastStartS: null }
        let now = 0
        const starts: number[] = []
        for (const a of seq) {
          now += a.gapS
          const out = attemptGrab(state, { ...a, maxHealth: MAX, nowS: now })
          // The blow that lands is the zombie's own, never more: a scare is never the sole cause.
          expect(out.damage).toBe(a.damage)
          if (out.plan) {
            starts.push(now)
            if (a.intensity === 'off') expect(out.plan.pull).toBe(false)
          }
          state = out.state
        }
        for (let i = 1; i < starts.length; i++) {
          expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(KILL_CAM.cooldownS)
        }
      }),
    )
  })
})

describe('cooldown', () => {
  it('opens at 60 s', () => {
    expect(cooledDown(null, 0)).toBe(true)
    expect(cooledDown(10, 10 + KILL_CAM.cooldownS - 0.01)).toBe(false)
    expect(cooledDown(10, 10 + KILL_CAM.cooldownS)).toBe(true)
  })
  it('a blocked attempt leaves the state as it was', () => {
    const s = { lastStartS: 5 }
    const out = attemptGrab(s, { ...base, nowS: 6, intensity: 'full', damage: 10 })
    expect(out.plan).toBeNull()
    expect(out.state).toBe(s)
  })
})

describe('camera pose', () => {
  it('looks at the zombie head', () => {
    const l = lookAt([0, 1.6, 0], { x: 0, z: 3 })
    expect(Math.abs(angleDelta(l.yaw, Math.PI))).toBeLessThan(1e-9)
    expect(l.pitch).toBeCloseTo(0)
  })
  it('turns the short way and holds once turned', () => {
    const from = { yaw: 3, pitch: 0 }
    const to = { yaw: -3, pitch: 0.2 }
    const end = grabPose(from, to, KILL_CAM.turnS, true)
    expect(Math.abs(angleDelta(end.yaw, to.yaw))).toBeLessThan(1e-9)
    // Short way round: 3 -> -3 passes through PI, not 0.
    const mid = grabPose(from, to, KILL_CAM.turnS / 2, true)
    expect(Math.abs(mid.yaw)).toBeGreaterThan(3)
    expect(end).toMatchObject({ pushM: KILL_CAM.pushM, fovDropDeg: KILL_CAM.fovDropDeg })
    expect(grabPose(from, to, 1, false)).toMatchObject({ pushM: 0, fovDropDeg: 0 })
  })
})

describe('edgeOpacity', () => {
  it('fades out by the end, pulsing or steady', () => {
    expect(edgeOpacity(KILL_CAM.edgeS, 'flash')).toBe(0)
    expect(edgeOpacity(KILL_CAM.edgeS, 'steady')).toBe(0)
    expect(edgeOpacity(0, 'flash')).toBeGreaterThan(0)
  })
  it('the steady edge never rises again once fading (no flicker)', () => {
    let last = Infinity
    for (let t = 0; t < KILL_CAM.edgeS; t += 0.01) {
      const o = edgeOpacity(t, 'steady')
      expect(o).toBeLessThanOrEqual(last + 1e-12)
      last = o
    }
  })
})

describe('grab sound and subtitle (Req 29.4)', () => {
  it('both stingers caption "[something seizes you]" and have a synth voice', () => {
    expect(GRAB_CAPTION).toBe('[something seizes you]')
    for (const id of ['grab-stinger', 'grab-stinger-soft'] as const) {
      expect(CAPTIONS.find((c) => c.event === id)?.text).toBe(GRAB_CAPTION)
      expect(SOUND_IDS).toContain(id)
    }
  })
})
