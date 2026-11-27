import { defineConfig } from '@playwright/test'

// Records the trailer's game shots (tools/video/shots.spec.ts) as frames in tools/video/clips/<shot>/;
// tools/video/trailer.mjs cuts them into the trailer. Headless, so the screen stays free.
// Run from the repo root: npx playwright test -c tools/video/playwright.video.config.ts
// Uses the system Chrome on the GPU, like the e2e suite, and the same dev server.
const DEV = 5173

export default defineConfig({
  testDir: '.',
  testMatch: 'shots.spec.ts',
  outputDir: './clips/pw',
  timeout: 10 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${DEV}`,
    viewport: { width: 1920, height: 1080 },
    channel: 'chrome',
    launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: `http://localhost:${DEV}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
