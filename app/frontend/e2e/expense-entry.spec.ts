import { expect, test } from '@playwright/test'
import { logExpense, signIn } from './helpers'

/**
 * DoD criterion 1 (5-second rule). The stopwatch here starts at the app
 * shell (post-auth - the household unlocks once per session, not per
 * expense) and stops when the entry has landed in the list. The real
 * measurement is on a phone; this asserts the flow itself stays tight.
 */
test('expense entry lands in under 5 seconds', async ({ page }) => {
  await signIn(page)

  const started = Date.now()
  await logExpense(page, '123')
  // Sheet closes on success and the list invalidates.
  await expect(page.getByPlaceholder('৳')).toBeHidden({ timeout: 5_000 })
  const elapsed = Date.now() - started

  expect(elapsed).toBeLessThan(5_000)
})
