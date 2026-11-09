import { describe, expect, it } from 'vitest'
import { flaskSplashRadius } from '../world/flaskRadius'
import { meleeHitEvents } from './meleeEvents'

describe('meleeHitEvents', () => {
  it('emits one event per zombie struck', () => {
    expect(meleeHitEvents(['a', 'b', 'a'], 'melee')).toEqual([
      { type: 'meleeHit', uid: 'a' },
      { type: 'meleeHit', uid: 'b' },
    ])
    expect(meleeHitEvents(['a'], 'heavy')).toHaveLength(1)
  })

  it('emits nothing for a kick', () => {
    expect(meleeHitEvents(['a', 'b'], 'kick')).toEqual([])
  })
})

describe('flaskSplashRadius', () => {
  it('a Blessed Reach flask is 1 m wider', () => {
    expect(flaskSplashRadius(1) - flaskSplashRadius(0)).toBe(1)
    expect(flaskSplashRadius(0)).toBe(2)
  })
})
