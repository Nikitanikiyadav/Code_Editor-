import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Any request starting with /api is forwarded to Django
      '/api': 'http://localhost:8000',
      // WebSocket connections starting with /ws are forwarded too
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})