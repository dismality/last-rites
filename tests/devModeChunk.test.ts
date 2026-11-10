// A1 (Requirement 2.10): developer mode ships only as a lazily loaded chunk. A normal visit to the
// production site never downloads or runs it; only ?dev=1 makes main.tsx fetch it.
import { build } from 'vite'
import type { Rollup } from 'vite'

// Strings that only exist in src/dev/ (the panel's class names and its entry point).
const DEV_MARKERS = ['dev-panel__body', 'dev-debug-views']

describe('developer mode is its own lazy chunk in production', () => {
  it('the entry chunk has none of the panel code, and a dynamic chunk holds it', async () => {
    // Vitest runs with NODE_ENV=test, which Vite would treat as dev (DEV true); force production.
    vi.stubEnv('NODE_ENV', 'production')
    const out = (await build({
      mode: 'production',
      logLevel: 'silent',
      build: { write: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[]
    vi.unstubAllEnvs()
    const chunks = (Array.isArray(out) ? out : [out])
      .flatMap((o) => o.output)
      .filter((o): o is Rollup.OutputChunk => o.type === 'chunk')

    const entry = chunks.filter((c) => c.isEntry)
    expect(entry.length).toBeGreaterThan(0)
    for (const c of entry) for (const m of DEV_MARKERS) expect(c.code, `${c.fileName}: ${m}`).not.toContain(m)

    const devChunks = chunks.filter((c) => DEV_MARKERS.some((m) => c.code.includes(m)))
    expect(devChunks.length).toBeGreaterThan(0)
    for (const c of devChunks) expect(c.isEntry, c.fileName).toBe(false)
    // The entry fetches it only behind the ?dev=1 check.
    // The minifier may write the strings with ', " or ` quotes.
    expect(entry.map((c) => c.code).join('\n')).toMatch(/dev['"`]\)\s*===\s*['"`]1['"`]/)
  }, 300_000)
})
