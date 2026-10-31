import { test, expect } from '@playwright/test'

test('Scalar renders the live API reference without a CDN or browser errors', async ({ page }, testInfo) => {
  const apiOrigin = `http://localhost:${process.env.PW_API_PORT ?? '3001'}`
  const errors: string[] = []
  const externalRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === apiOrigin) return route.continue()
    externalRequests.push(route.request().url())
    return route.abort()
  })
  const specResponse = page.waitForResponse(response => response.url() === `${apiOrigin}/api/openapi.json`)
  await page.goto(`${apiOrigin}/api/docs`)
  expect((await specResponse).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'BA Helper API', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Sign in with email and password', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask AI', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('scalar-api-reference.png'), fullPage: false })
  expect(errors).toEqual([])
  expect(externalRequests).toEqual([])
})
