import { defineConfig } from '@playwright/test'

/**
 * E2E runs against the BUILT app served by `vite preview` (service worker
 * active) with the API proxied to the local backend, which must be running
 * with the seed data (see README).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
