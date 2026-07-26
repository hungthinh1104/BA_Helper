import { test, expect } from '@playwright/test'
import { seedDemo, type DemoSeed } from './fixtures/seed'
import { login } from './fixtures/auth'

/**
 * The headline journey: an open review queue → decide every item → the primary
 * CTA becomes Finalize → confirm → the approved report opens.
 */
test.describe('decision-to-report journey', () => {
  let seed: DemoSeed

  test.beforeEach(async ({ page }) => {
    seed = seedDemo()
    await login(page, seed)
  })

  test('accept all review items, finalize, and reach the approved report', async ({ page }) => {
    await page.goto(`/analyses/${seed.analysisId}?view=review&locale=en-US`)

    const workbench = page.locator('[data-review-workbench]')
    await expect(workbench).toBeVisible()
    await expect(page.locator('[data-stale-notice]')).toHaveCount(0)

    // Decide every review item via the desktop decision panel. Each accept
    // persists optimistically and auto-advances to the next NEEDS_REVIEW item.
    const panel = page.locator('[data-decision-panel]')
    const complete = page.locator('[data-review-complete]')
    for (let i = 0; i < 12; i += 1) {
      if (await complete.isVisible().catch(() => false)) break
      await panel.getByRole('button', { name: 'Accept', exact: true }).click()
      await page.waitForTimeout(400)
    }
    await expect(complete).toBeVisible()

    // Finalize from the header CTA → confirm in the dialog.
    await page.getByRole('button', { name: 'Finalize', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Finalize Impact Analysis')).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirm Finalize' }).click()

    // The approved report opens for this analysis.
    await page.waitForURL(/\/reports\?analysisId=/, { timeout: 30_000 })
  })
})
