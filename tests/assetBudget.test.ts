import { describe, expect, it } from 'vitest'
import { filesWithSizes } from './helpers/fileSizes'

// Spec 11 Req 8.15: the initial download stays under 25 MB. Everything in public/assets is
// fetched before or during play, so the whole folder is held to the budget.
const BUDGET_BYTES = 25 * 1024 * 1024

describe('asset budget', () => {
  it('keeps public/assets under 25 MB', async () => {
    const files = await filesWithSizes('public/assets')
    const total = files.reduce((sum, f) => sum + f.bytes, 0)
    const biggest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((f) => `${f.path} ${(f.bytes / 1048576).toFixed(2)} MB`)
    expect(total, `public/assets is ${(total / 1048576).toFixed(2)} MB; largest: ${biggest.join(', ')}`).toBeLessThan(BUDGET_BYTES)
    expect(files.length).toBeGreaterThan(0)
  })
})
