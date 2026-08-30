import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PWA plugin is added in M7 - config kept minimal until then.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Same-origin API in dev: the refresh cookie never needs CORS.
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
