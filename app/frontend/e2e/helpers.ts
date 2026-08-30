import { expect, type Page } from '@playwright/test'

export const EMAIL = process.env.E2E_EMAIL ?? 'user1@example.com'
export const PASSWORD = process.env.E2E_PASSWORD ?? 'change-me'
export const PIN = process.env.E2E_PIN ?? '123456'

/** Sign in and pass (or set) the PIN gate. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/')
  // Either the login form or (session cookie alive) the PIN gate appears.
  const emailInput = page.getByPlaceholder(/email|ইমেইল/i)
  const pinReady = page.locator('input[inputmode="numeric"]')
  await expect(emailInput.or(pinReady).first()).toBeVisible({ timeout: 10_000 })

  if (await emailInput.isVisible()) {
    await emailInput.fill(EMAIL)
    await page.getByPlaceholder(/password|পাসওয়ার্ড/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in|সাইন ইন/i }).click()
  }

  // PIN gate: verify, or first-run setup (password + new PIN).
  await expect(pinReady.first()).toBeVisible({ timeout: 10_000 })
  const passwordField = page.getByPlaceholder(/account password|অ্যাকাউন্ট পাসওয়ার্ড/i)
  if (await passwordField.isVisible()) {
    await passwordField.fill(PASSWORD)
    await pinReady.first().fill(PIN)
    await page.getByRole('button', { name: /save pin|পিন সংরক্ষণ/i }).click()
  } else {
    await pinReady.first().fill(PIN)
  }
  // The shell's bottom nav proves we are through both gates.
  await expect(page.locator('nav')).toBeVisible({ timeout: 10_000 })
}

/** Open quick-add, enter an amount, pick the first category. */
export async function logExpense(page: Page, amount: string): Promise<void> {
  await page.getByRole('button', { name: '+', exact: true }).click()
  await page.getByPlaceholder('৳').fill(amount)
  await page.locator('.grid button').first().click()
}
