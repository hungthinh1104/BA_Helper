import { test, expect } from '@playwright/test'
import { seedDemo, type DemoSeed } from './fixtures/seed'
import { login } from './fixtures/auth'

/**
 * Mobile single-pane review (Pixel 7): queue → detail, the sticky full action
 * bar, and the rationale-gated reject flow through the bottom sheet.
 */
test.describe('mobile single-pane review', () => {
  let seed: DemoSeed

  test.beforeEach(async ({ page }) => {
    seed = seedDemo()
    await login(page, seed)
  })

  test('drill into an item, reject via the rationale sheet, return to the queue', async ({ page }) => {
    await page.goto(`/analyses/${seed.analysisId}?view=review&locale=en-US`)
    await expect(page.locator('[data-review-workbench]')).toBeVisible()

    // The queue is the initial pane on mobile; drill into the first item.
    const queue = page.locator('[data-review-queue]')
    await expect(queue).toBeVisible()
    await queue.getByRole('button').first().click()

    // Detail pane exposes the sticky full action bar + a back control.
    const bar = page.locator('[data-mobile-action-bar]')
    await expect(bar).toBeVisible()
    await expect(page.locator('[data-back-to-queue]')).toBeVisible()

    // Reject is rationale-gated → opens the bottom sheet.
    await bar.getByRole('button', { name: 'Reject', exact: true }).click()
    const sheet = page.locator('[data-rationale-sheet]')
    await expect(sheet).toBeVisible()
    await sheet.locator('textarea').fill('Not impacted by this change.')
    await sheet.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(sheet).toBeHidden()

    // Back returns to the queue pane.
    await page.locator('[data-back-to-queue]').click()
    await expect(queue).toBeVisible()
  })
})
