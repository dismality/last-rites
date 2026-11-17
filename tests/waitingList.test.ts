import { describe, expect, it } from 'vitest'
import { PLACEHOLDERS } from '../src/data/placeholders'
import { missingFiles } from '../src/game/systems/waitingList'

// Spec 11 Req 8.16 and design decision 8: the build-time half of the Waiting_List. The declared
// art files (data/placeholders.ts) are compared with what is under public/assets/; a file that is
// not there is listed as waiting on Claude's art. This reflects the repo, with no browser.

const ON_DISK = new Set(
  Object.keys(import.meta.glob('../public/assets/**/*.{glb,webp,png,ogg,mp3}')).map((p) => p.replace('../public', '')),
)

describe('the art waiting list', () => {
  const declared = PLACEHOLDERS.map((r) => r.path)
  const waiting = missingFiles(declared, ON_DISK)

  it('declares each file once, under /assets/, with a kind that matches its extension', () => {
    expect(new Set(declared).size).toBe(declared.length)
    for (const r of PLACEHOLDERS) {
      expect(r.path, r.path).toMatch(/^\/assets\//)
      const ext = r.path.split('.').pop()
      const want = { glb: ['model'], webp: ['image'], png: ['texture', 'image'], ogg: ['sound'], mp3: ['sound'] }[ext ?? ''] ?? []
      expect(want, r.path).toContain(r.kind)
      expect(r.use.trim().length, r.path).toBeGreaterThan(0)
    }
  })

  it('lists exactly the declared files that are not on disk', () => {
    expect(waiting).toEqual(declared.filter((p) => !ON_DISK.has(p)).sort())
    for (const p of waiting) expect(ON_DISK.has(p)).toBe(false)
    for (const p of declared.filter((d) => !waiting.includes(d))) expect(ON_DISK.has(p)).toBe(true)
  })

  it('knows the models that have landed are not waiting', () => {
    expect(waiting).not.toContain('/assets/models/props/vending-machine.glb')
    expect(waiting).not.toContain('/assets/models/props/bat-perched.glb')
  })

  it('prints the list for the final report', () => {
    // Shown with `npx vitest run tests/waitingList.test.ts --reporter verbose`.
    console.info(`Waiting on art (${waiting.length}):\n${waiting.map((p) => `  public${p}`).join('\n')}`)
    expect(Array.isArray(waiting)).toBe(true)
  })
})
