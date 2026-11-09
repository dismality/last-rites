import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { FIREARMS } from '../../data/firearms'
import {
  addKick,
  aimBlend,
  aimFovDeg,
  aimMoveMult,
  impactShakeAllowed,
  INITIAL_RECOIL,
  recoilKickDeg,
  recoilOffsetRad,
  spreadDeg,
  tickRecoil,
} from './recoil'

const firearm = fc.constantFrom(...FIREARMS)

describe('recoil', () => {
  it('halves the kick when camera shake is off', () => {
    expect(recoilKickDeg(6, true)).toBe(6)
    expect(recoilKickDeg(6, false)).toBe(3)
  })

  it('stacks a second kick on the remaining offset', () => {
    const a = addKick(INITIAL_RECOIL, 2.5, 0.3)
    const b = addKick(tickRecoil(a, 0.1), 2.5, 0.3)
    expect(b.peakRad).toBeGreaterThan(a.peakRad * 0.99 - 1e-9)
    expect(b.ageS).toBe(0)
  })

  it('ignores a non-finite kick', () => {
    expect(recoilOffsetRad(addKick(INITIAL_RECOIL, NaN, 0.3))).toBe(0)
  })

  it('aimed move multiplier is 0.7 only while aiming', () => {
    expect(aimMoveMult(true)).toBe(0.7)
    expect(aimMoveMult(false)).toBe(1)
  })

  it('impact shake needs camera shake and full scare intensity', () => {
    expect(impactShakeAllowed(true, 'full')).toBe(true)
    expect(impactShakeAllowed(true, 'reduced')).toBe(false)
    expect(impactShakeAllowed(true, 'off')).toBe(false)
    expect(impactShakeAllowed(false, 'full')).toBe(false)
  })
})

describe('Feature: 07-combat-and-enemies, Property 11: Recoil, aim and spread follow the settings', () => {
  // **Validates: Requirements 5.1, 5.2, 5.4, 5.5, 5.6, 21.3**
  it('kick is the table value or half; offset is non-increasing and 0 at recovery', () => {
    fc.assert(
      fc.property(
        firearm,
        fc.boolean(),
        fc.array(fc.double({ min: 0.001, max: 0.2, noNaN: true }), { maxLength: 40 }),
        (f, shake, dts) => {
          const kick = recoilKickDeg(f.recoilUpDeg, shake)
          expect(kick).toBe(shake ? f.recoilUpDeg : f.recoilUpDeg / 2)
          let s = addKick(INITIAL_RECOIL, kick, f.recoilRecoverS)
          expect(recoilOffsetRad(s)).toBeCloseTo((kick * Math.PI) / 180, 9)
          let prev = recoilOffsetRad(s)
          let t = 0
          for (const dt of dts) {
            s = tickRecoil(s, dt)
            t += dt
            const o = recoilOffsetRad(s)
            expect(o).toBeLessThanOrEqual(prev + 1e-12)
            expect(o).toBeGreaterThanOrEqual(0)
            if (t >= f.recoilRecoverS) expect(o).toBe(0)
            prev = o
          }
        },
      ),
    )
  })

  it('aim blend stays in 0..1 and fov is setting minus 10 x blend', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.double({ min: 0, max: 0.5, noNaN: true })), { maxLength: 60 }),
        fc.integer({ min: 60, max: 100 }),
        (steps, fov) => {
          let b = 0
          for (const [aim, dt] of steps) {
            b = aimBlend(b, aim, dt)
            expect(b).toBeGreaterThanOrEqual(0)
            expect(b).toBeLessThanOrEqual(1)
            expect(aimFovDeg(fov, b)).toBeCloseTo(fov - 10 * b, 9)
          }
        },
      ),
    )
  })

  it('aiming picks the aimed spread, otherwise the hip spread', () => {
    fc.assert(
      fc.property(firearm, fc.boolean(), (f, aiming) => {
        expect(spreadDeg(f, aiming)).toBe(aiming ? f.spreadAimedDeg : f.spreadHipDeg)
      }),
    )
  })
})
