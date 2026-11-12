// Structure test for the interaction audit table: every <Interactable> in src/scene names a kind
// from data/interactables.ts, every kind is used, and the files and wording agree.
import { describe, expect, it } from 'vitest'
import { ACTION_LABEL } from '../game/systems/interaction'
import {
  INTERACTABLE_KINDS,
  INTERACTABLES,
  PROXIMITY_TRIGGERS,
  type CueCategory,
} from './interactables'

const sources = import.meta.glob('../scene/**/*.tsx', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Every `<Interactable ...>` opening tag, with the file it is in. */
function interactableTags(): Array<{ file: string; tag: string }> {
  const out: Array<{ file: string; tag: string }> = []
  for (const [path, code] of Object.entries(sources)) {
    if (path.endsWith('/Interactable.tsx')) continue
    for (const m of code.matchAll(/<Interactable\b[\s\S]*?\n?\s*(?:onInteract|>)/g)) {
      out.push({ file: path.split('/').pop() as string, tag: m[0] })
    }
  }
  return out
}

describe('interaction audit table', () => {
  const tags = interactableTags()

  it('finds the interactables in the scene source', () => {
    expect(tags.length).toBeGreaterThanOrEqual(INTERACTABLE_KINDS.length)
  })

  it('every <Interactable> in src/scene names a kind that is in the table, and none sets an action', () => {
    for (const { file, tag } of tags) {
      const kind = /kind="([a-z-]+)"/.exec(tag)?.[1]
      expect(kind, `${file}: ${tag}`).toBeDefined()
      expect(INTERACTABLE_KINDS, `${file}`).toContain(kind)
      expect(tag, `${file} sets action directly`).not.toMatch(/\baction=/)
    }
  })

  it('every kind in the table is mounted by the file the table names', () => {
    for (const kind of INTERACTABLE_KINDS) {
      const def = INTERACTABLES[kind]
      expect(def.kind).toBe(kind)
      const entry = tags.filter((t) => t.file === def.file && t.tag.includes(`kind="${kind}"`))
      expect(entry.length, `${kind} in ${def.file}`).toBeGreaterThan(0)
    }
  })

  it('every proximity trigger file exists in the scene', () => {
    const files = Object.keys(sources).map((p) => p.split('/').pop())
    for (const def of Object.values(PROXIMITY_TRIGGERS)) {
      expect(files, def.kind).toContain(def.file)
    }
  })

  it('has a category, an action verb and sensible wording for each kind', () => {
    const categories: CueCategory[] = ['used-up', 'needs', 'repeatable']
    for (const kind of INTERACTABLE_KINDS) {
      const def = INTERACTABLES[kind]
      expect(categories).toContain(def.category)
      expect(ACTION_LABEL[def.action]).toBeTruthy()
      expect(def.endsWhen.length).toBeGreaterThan(0)
      expect(def.resetsOn.length).toBeGreaterThan(0)
      if (def.needs) {
        expect(def.needs.what.length).toBeGreaterThan(0)
        // A needs prompt is never a "Hold E" or "E:" action prompt.
        expect(def.needs.prompt).not.toMatch(/\bHold\b|\bPress\b|^E:/)
      }
      // Repeatable kinds that can go idle say what they show instead.
      if (def.idlePrompt) expect(def.category).toBe('repeatable')
    }
  })

  it('items you take fade with their cues; places and people stay', () => {
    const fades = INTERACTABLE_KINDS.filter((k) => INTERACTABLES[k].fadesBody).sort()
    expect(fades).toEqual(['clue-spot', 'dropped-stack', 'fixed-spawn', 'material-pickup', 'weapon-pickup'])
  })
})
