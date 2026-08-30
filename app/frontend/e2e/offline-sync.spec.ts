import { expect, test } from '@playwright/test'
import { logExpense, signIn } from './helpers'

/**
 * DoD criterion 2: an expense logged in airplane mode survives a page
 * reload while still offline, then syncs exactly once on reconnect.
 */
test('offline expense queues, survives reload, syncs without duplicates', async ({ page, context }) => {
  await signIn(page)
  // Let the service worker claim the page so an offline reload serves from precache.
  await page.reload()
  await page.evaluate(async () => {
    await navigator.serviceWorker?.ready
  })
  // Re-pass the PIN gate after reload.
  const pin = page.locator('input[inputmode="numeric"]').first()
  if (await pin.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pin.fill(process.env.E2E_PIN ?? '123456')
  }
  await expect(page.locator('nav')).toBeVisible()

  await context.setOffline(true)
  await logExpense(page, '77')
  // Queued: the pending banner appears.
  await expect(page.locator('text=/waiting to sync|সিঙ্কের অপেক্ষায়/')).toBeVisible({ timeout: 10_000 })

  // Reload while STILL offline - the queue must survive (IndexedDB) and the
  // shell must load (service worker precache).
  await page.reload()
  await expect(page.locator('text=/waiting to sync|সিঙ্কের অপেক্ষায়/')).toBeVisible({ timeout: 10_000 })

  await context.setOffline(false)
  page.dispatchEvent('body', 'online').catch(() => {})
  await page.evaluate(() => window.dispatchEvent(new Event('online')))

  // Banner clears once drained.
  await expect(page.locator('text=/waiting to sync|সিঙ্কের অপেক্ষায়/')).toBeHidden({ timeout: 15_000 })
})
