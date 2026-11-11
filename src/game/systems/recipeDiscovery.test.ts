import { describe, expect, it } from 'vitest'
import type { Inventory } from '../types'
import { mergeCollected } from './recipeDiscovery'

const inv = (...items: string[]): Inventory =>
  ({ slots: items.map((item) => ({ item, qty: 1 })), keyItems: [], relics: [] }) as unknown as Inventory

describe('mergeCollected', () => {
  it('adds new items once and keeps the order', () => {
    expect(mergeCollected(['bone'], inv('cloth', 'bone', 'cloth'))).toEqual(['bone', 'cloth'])
  })
  it('never forgets an item that left the satchel', () => {
    expect(mergeCollected(['bone'], inv())).toEqual(['bone'])
  })
})