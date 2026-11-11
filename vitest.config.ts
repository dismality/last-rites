import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Playwright specs run with 'npm run e2e', not under vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Without this, `?raw` CSS imports resolve to '' and the font-size structure tests pass vacuously.
    css: true,
    // Audio is muted in the app (AUDIO_ENABLED); tests exercise the real audio paths with it forced on.
    setupFiles: ['src/audio/testSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
