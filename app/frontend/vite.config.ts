import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Workbox handles ASSET precaching only. Write mutations go through the
    // app-level IndexedDB queue (src/lib/offline-queue.ts) - deliberately
    // NOT Workbox Background Sync, which would replay stale auth headers.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Personal Finance',
        short_name: 'Finance',
        description: 'Household finance & budget tracker',
        theme_color: '#059669',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The app shell loads offline; API calls are NOT cached - reads may
        // require network in Phase 1 (spec §6.1: writes never fail, reads may).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  preview: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
