import { test, expect } from '@playwright/test'
import { seedDemo } from './fixtures/seed'
import { login } from './fixtures/auth'

test('analysis list recovers from a failed request with an explicit retry', async ({ page }) => {
  const seed = seedDemo()
  await login(page, seed)

  let recovered = false
  let requests = 0
  let releaseRetryResponse: (() => void) | undefined
  const retryResponseGate = new Promise<void>(resolve => { releaseRetryResponse = resolve })
  await page.route(`**/api/v1/projects/${seed.projectId}/analyses**`, async route => {
    requests += 1
    if (!recovered) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 502, message: 'Temporary analysis list outage', error: 'Bad Gateway' }),
      })
      return
    }

    await retryResponseGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  })

  await page.goto('/analyses')
  const errorAlert = page.getByRole('alert').filter({ hasText: 'Failed to load analyses' })
  await expect(errorAlert).toContainText('Failed to load analyses')
  const retryButton = page.getByRole('button', { name: 'Retry', exact: true })
  await expect(retryButton).toBeVisible()

  recovered = true
  await retryButton.press('Enter')
  const retryingButton = page.getByRole('button', { name: 'Retrying...', exact: true })
  await expect(retryingButton).toBeDisabled()
  releaseRetryResponse?.()

  await expect(page.getByText('No analyses yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeVisible()
  expect(requests).toBeGreaterThan(1)
})
