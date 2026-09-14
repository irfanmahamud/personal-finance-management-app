import { defineConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // e2e/ is Playwright's - its *.spec.ts files match vitest's default
    // include glob and blow up when collected by the wrong runner.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
