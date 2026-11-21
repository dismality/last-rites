import { defineConfig } from '@playwright/test'

// Records the demo video's raw clips (tools/video/record.spec.ts). Not part of `npm run e2e`.
//   npx playwright test -c tools/video            every shot
//   npx playwright test -c tools/video -g night   one shot
// Chrome opens full screen on the main monitor and the screen is captured with ffmpeg, so leave
// the computer alone while it runs. Clips go to tools/video/clips (not committed).
export default defineConfig({
  testDir: '.',
  testMatch: 'record.spec.ts',
  outputDir: '../../test-results/video',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    viewport: null,
    channel: 'chrome',
    launchOptions: {
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--use-angle=d3d11',
        '--enable-gpu',
        '--ignore-gpu-blocklist',
        '--window-position=0,0',
        '--window-size=1920,1080',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-infobars',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
