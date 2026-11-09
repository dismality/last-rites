import { defineConfig } from '@playwright/test'

// Uses the system Chrome (channel 'chrome') so no browser download is needed.
// Headless Chrome has no GPU, so WebGL runs on SwiftShader; frame times are therefore pessimistic.
// Run headed with: npx playwright test --headed
const PORT = 5173

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    channel: 'chrome',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
