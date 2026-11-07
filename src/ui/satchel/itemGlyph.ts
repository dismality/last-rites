import type { ItemKind } from '../../data/items'

// Small rune per item kind so a pocket is readable by shape, not colour alone.
const GLYPHS: Record<ItemKind, string> = {
  material: '❖',
  weapon: '†',
  consumable: '✚',
  placeable: '◈',
  key: '⚷',
  relic: '✠',
  lore: '❡',
}

export function itemGlyph(kind: ItemKind): string {
  return GLYPHS[kind]
}
