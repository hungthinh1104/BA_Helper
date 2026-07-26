import { test, expect } from '@playwright/test'
import { seedDemo, type DemoSeed } from './fixtures/seed'
import { login } from './fixtures/auth'

/**
 * Keyboard-only decision: the global 'a' shortcut accepts the selected review
 * item without the mouse (shortcuts are ignored while a text input is focused).
 * The persisted "Reviewed" count is the stable signal — the decision panel
 * auto-advances after a decision. The full multi-item loop is covered by the
 * desktop decision-to-report journey.
 */
test.describe('keyboard-only decision loop', () => {
  let seed: DemoSeed

  test.beforeEach(async ({ page }) => {
    seed = seedDemo()
    await login(page, seed)
  })

  test('accept the selected item with a keyboard shortcut', async ({ page }) => {
    await page.goto(`/analyses/${seed.analysisId}?view=review&locale=en-US`)
    await expect(page.locator('[data-review-workbench]')).toBeVisible()

    const reviewed = (n: number) =>
      page.getByRole('button', { name: `Reviewed ${n}`, exact: true })
    await expect(reviewed(0)).toBeVisible()

    // 'a' accepts the selected item; the persisted Reviewed count confirms it.
    await page.keyboard.press('a')
    await expect(reviewed(1)).toBeVisible()
  })
})
