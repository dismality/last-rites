import { createLogger, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  // Rapier WASM needs to be served correctly
  optimizeDeps: {
    exclude: ['@react-three/rapier'],
  },
})