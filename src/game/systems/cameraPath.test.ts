import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../../data/cemeteryLayout'
import { samplePath } from './cameraPath'

const PTS: Vec3[] = [
  [0, 0, 0],
  [1, 2, 3],
  [4, 2, 1],
  [6, 0, 5],
]

describe('samplePath', () => {
  it('starts and ends on the first and last control points', () => {
    expect(samplePath(PTS, 0)).toEqual(PTS[0])
    const end = samplePath(PTS, 1)
    end.forEach((v, i) => expect(v).toBeCloseTo(PTS[3][i], 9))
  })

  it('passes through interior control points', () => {
    const mid = samplePath(PTS, 1 / 3)
    mid.forEach((v, i) => expect(v).toBeCloseTo(PTS[1][i], 9))
  })

  it('clamps u outside 0..1 and tolerates NaN', () => {
    expect(samplePath(PTS, -5)).toEqual(samplePath(PTS, 0))
    expect(samplePath(PTS, 9)).toEqual(samplePath(PTS, 1))
    expect(samplePath(PTS, NaN)).toEqual(samplePath(PTS, 0))
  })

  it('handles empty and single-point paths', () => {
    expect(samplePath([], 0.5)).toEqual([0, 0, 0])
    expect(samplePath([[1, 2, 3]], 0.5)).toEqual([1, 2, 3])
  })
})
