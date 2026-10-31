import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rapier WASM needs to be served correctly
  optimizeDeps: {
    exclude: ['@react-three/rapier'],
  },
})
