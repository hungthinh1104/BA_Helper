import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { seedDemo } from './fixtures/seed'
import { seedReviewableMultiRepoRun } from './fixtures/multi-repo-run'

test('review and finalize a persisted multi-repository report', async ({ page }) => {
  test.setTimeout(600_000)
  const seed = seedDemo()
  const runId = await seedReviewableMultiRepoRun(seed)

  await login(page, seed)
  await page.goto(`/analyses/runs/${runId}`)
  await expect(page.getByRole('heading', { name: 'Multi-repo Analysis Run' })).toBeVisible()
  await page.getByRole('tab', { name: 'Child Analyses' }).click()
  await expect(page.getByText('booking-cancellation')).toBeVisible()
  await expect(page.getByText('payment-service')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finalize merged report' })).toBeEnabled()

  const finalizeResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    response.url().split('?')[0].endsWith(
      `/api/v1/multi-repo-runs/${runId}/merged-report/finalize`,
    ),
  )
  await page.getByRole('button', { name: 'Finalize merged report' }).click()
  const response = await finalizeResponse
  expect(response.headers()['content-type']).toContain('application/json')
  expect(
    response.ok(),
    `Merged report finalization returned HTTP ${response.status()}`,
  ).toBe(true)
  await expect(page).toHaveURL(new RegExp(`/analyses/runs/${runId}/merged-report$`), {
    timeout: 120_000,
  })
  await expect(page.getByRole('heading', { name: 'Approved Merged Report' })).toBeVisible()
  await expect(page.getByText('Refund impact in booking-cancellation').first()).toBeVisible()
  await expect(page.getByText('Refund impact in payment-service').first()).toBeVisible()

  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText('Merged report review decision recorded.')).toBeVisible()
  const reviewPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Merged Report Review' }),
  })
  await expect(reviewPanel.getByText('ACCEPTED', { exact: true })).toBeVisible()

  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })

    for (const route of [
      {
        path: `/analyses/runs/${runId}`,
        heading: 'Multi-repo Analysis Run',
      },
      {
        path: `/analyses/runs/${runId}/merged-report`,
        heading: 'Approved Merged Report',
      },
    ]) {
      await page.goto(route.path)
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, `${route.path} overflows horizontally at ${width}px`).toBe(false)
    }
  }
})
