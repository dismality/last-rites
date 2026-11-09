// The browser-test hook (window.__lastRites) must never ship. It is loaded by a dynamic import behind
// import.meta.env.DEV in main.tsx, so a production build has to drop it entirely.
import { build } from 'vite'
import type { Rollup } from 'vite'

const MARKERS = ['__lastRites', 'installDebugHook', 'installFrameRecorder', 'lockOverride.enabled = true']

const sources = import.meta.glob('../src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('debug hook is dev only', () => {
  it('is imported only from main.tsx, dynamically, behind import.meta.env.DEV', () => {
    const importers = Object.entries(sources)
      .filter(
        ([file, code]) =>
          !file.startsWith('../src/debug/') &&
          /from\s+['"][^'"]*\/debug\/|import\(\s*['"][^'"]*\/debug\//.test(code),
      )
      .map(([file]) => file)
    expect(importers).toEqual(['../src/main.tsx'])
    const main = sources['../src/main.tsx']
    expect(main).toMatch(/if \(import\.meta\.env\.DEV\) void import\('\.\/debug\/debugHook'\)/)
    expect(main).not.toMatch(/^import .*debug\//m)
  })

  it('production build output contains no trace of the hook', async () => {
    // Vitest runs with NODE_ENV=test, which Vite would treat as dev (DEV true); force production.
    vi.stubEnv('NODE_ENV', 'production')
    // Real production build of the project (cwd is the repo root under vitest), kept in memory.
    const out = (await build({
      mode: 'production',
      logLevel: 'silent',
      build: { write: false },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[]
    vi.unstubAllEnvs()
    const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output)
    const code = outputs.map((o) => (o.type === 'chunk' ? o.code : '')).join('\n')
    expect(code.length).toBeGreaterThan(1000)
    for (const m of MARKERS) expect(code, m).not.toContain(m)
    expect(outputs.some((o) => o.fileName.includes('debugHook'))).toBe(false)
  }, 300_000)
})
