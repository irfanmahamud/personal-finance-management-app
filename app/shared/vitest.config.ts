import { defineConfig } from 'vitest/config'

// Pure-logic package: no DOM, no setup file - if a test in here needs jsdom,
// the module under test does not belong in @app/shared.
export default defineConfig({
  test: { environment: 'node' },
})
