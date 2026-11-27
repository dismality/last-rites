import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { audioManifestPlugin } from './tools/audio/audioManifestPlugin.mjs'

// src/data/graveyardColliders.ts imports public/assets/models/scene/graveyard-colliders.json on
// purpose, so the scene and the unit tests read the very same boxes (user decision, spec 09 11i).
// Vite warns about importing from public/ each time; drop only that message.
const logger = createLogger()
const PUBLIC_IMPORT = 'graveyard-colliders.json'
for (const level of ['warn', 'warnOnce'] as const) {
  const original = logger[level]
  logger[level] = (msg, options) => {
    if (msg.includes('Assets in public directory cannot be imported') || msg.includes(PUBLIC_IMPORT)) return
    original(msg, options)
  }
}

export default defineConfig({
  customLogger: logger,
  // audioManifestPlugin: lists public/assets/audio for the recorded-sound loader (src/audio/samples.ts).
  plugins: [react(), audioManifestPlugin()],
  // Rapier WASM needs to be served correctly
  optimizeDeps: {
    exclude: ['@react-three/rapier'],
  },
  // The libraries in their own files (playtest, 2026-11-28): one 4.3 MB file became several, so the
  // browser fetches them side by side and a redeploy of the game code leaves the libraries cached.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules[\/]three[\/]/ },
            { name: 'vendor-physics', test: /node_modules[\/]@dimforge[\/]/ },
            { name: 'vendor-r3f', test: /node_modules[\/](@react-three|three-stdlib|postprocessing|maath|troika)/ },
            { name: 'vendor-react', test: /node_modules[\/](react|react-dom|scheduler|zustand)[\/]/ },
            { name: 'vendor', test: /node_modules[\/]/ },
          ],
        },
      },
    },
  },
})