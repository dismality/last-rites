import { defineConfig } from '@playwright/test'

// Uses the system Chrome (channel 'chrome') so no browser download is needed.
//
// GPU by default: headless Chrome can use this machine's GPU through ANGLE/D3D11, which makes a
// frame take a few ms instead of ~270 ms on SwiftShader. Set E2E_SWIFTSHADER=1 for a worst-case
// software-rendering run (pessimistic frame times, the old behaviour), e.g. on Windows:
//   cmd /c "set E2E_SWIFTSHADER=1&& npm run e2e"
// Run headed with: npx playwright test --headed
const DEV = 5173
const SWIFTSHADER = process.env.E2E_SWIFTSHADER === '1'

const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
const SWIFTSHADER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

/** Specs that measure frame times: they run alone, on one worker, after everything else. */
const PERF_SPECS = ['**/look-perf.spec.ts', '**/graveyard-perf.spec.ts', '**/minimap.spec.ts', '**/items-13-15.spec.ts']

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  // The dev server is shared (reuseExistingServer); each test has its own browser context.
  workers: 3,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${DEV}`,
    viewport: { width: 1280, height: 720 },
    channel: 'chrome',
    launchOptions: { args: SWIFTSHADER ? SWIFTSHADER_ARGS : GPU_ARGS },
  },
  projects: [
    { name: 'main', testIgnore: PERF_SPECS },
    // No dependency on 'main' (it would pull the whole suite into any perf-only run). `npm run e2e`
    // runs main, then perf, so frame-time specs never share the machine with other tests.
    { name: 'perf', testMatch: PERF_SPECS, workers: 1 },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: `http://localhost:${DEV}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})