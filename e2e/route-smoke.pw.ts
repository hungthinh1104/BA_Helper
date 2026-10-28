import { test, expect } from '@playwright/test'
import { seedDemo } from './fixtures/seed'
import { login } from './fixtures/auth'

test('direct navigation resolves all inventoried user-facing routes', async ({ page }) => {
  test.setTimeout(600_000)
  const seed = seedDemo()
  const pageErrors: string[] = []
  const translationErrors: string[] = []
  const apiServerErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('MISSING_MESSAGE')) {
      translationErrors.push(message.text())
    }
  })
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 500) {
      apiServerErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  await page.goto('/login')
  await expect(page.locator('#email')).toBeVisible()
  await login(page, seed)

  const missingRunId = '00000000-0000-4000-8000-000000000999'
  const routes = [
    { name: 'workspace home', path: '/' },
    { name: 'analysis list', path: '/analyses' },
    { name: 'analysis detail with query state', path: `/analyses/${seed.analysisId}?view=review&locale=en-US` },
    { name: 'multi-repo run list', path: '/analyses/runs' },
    { name: 'missing multi-repo run', path: `/analyses/runs/${missingRunId}`, notFound: true },
    { name: 'missing merged report', path: `/analyses/runs/${missingRunId}/merged-report`, notFound: true },
    { name: 'reports list', path: '/reports' },
    { name: 'repository list', path: '/repositories' },
    { name: 'repository detail', path: `/repositories/${seed.repositoryId}` },
    {
      name: 'code comprehension deep link',
      path: `/repositories/${seed.repositoryId}/snapshots/${seed.snapshotId}/artifacts/${seed.artifactId}`,
    },
    { name: 'requirement list', path: '/requirements' },
    { name: 'requirement detail', path: `/requirements/${seed.requirementId}` },
    { name: 'settings home', path: '/settings' },
    { name: 'profile settings', path: '/settings/profile' },
    { name: 'project member settings', path: '/settings/members' },
    { name: 'marketing welcome', path: '/welcome' },
    { name: 'approved report print view', path: `/reports/${seed.completedAnalysisId}/print` },
  ]

  for (const route of routes) {
    await test.step(route.name, async () => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route.path} returned a server error`).toBeLessThan(500)
      expect(new URL(page.url()).pathname, `${route.path} redirected unexpectedly`).toBe(new URL(route.path, page.url()).pathname)
      await expect(page.locator('body')).toBeVisible()

      if (route.notFound) {
        await expect(page.getByText('Page not found', { exact: true })).toBeVisible()
      } else {
        await expect(page.locator('main').first()).toBeVisible()
      }
    })
  }

  await page.goto(`/analyses/${seed.analysisId}?view=review&locale=en-US`)
  await expect(page).toHaveURL(new RegExp(`view=review.*locale=en-US|locale=en-US.*view=review`))
  await page.goto(`/requirements/${seed.requirementId}`)
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/analyses/${seed.analysisId}.*view=review`))
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`/requirements/${seed.requirementId}`))
  await page.reload()
  await expect(page).toHaveURL(new RegExp(`/requirements/${seed.requirementId}`))

  expect(pageErrors, 'browser runtime errors while resolving routes').toEqual([])
  expect(translationErrors, 'missing UI translation keys while resolving routes').toEqual([])
  expect(apiServerErrors, 'API 5xx responses while resolving routes').toEqual([])
})

test('active navigation distinguishes analysis and multi-repo routes', async ({ page }) => {
  const seed = seedDemo()
  await login(page, seed)

  await page.goto('/analyses/runs')
  const activeRunLink = page.locator('aside.app-sidebar a[data-active="true"]')
  await expect(activeRunLink).toHaveCount(1)
  await expect(activeRunLink).toHaveAttribute('href', /\/analyses\/runs(?:[?#]|$)/)
  await expect(page.locator('aside.app-sidebar a[href="/analyses"], aside.app-sidebar a[href^="/analyses?"]'))
    .not.toHaveAttribute('data-active', 'true')

  await page.goto(`/analyses/${seed.analysisId}`)
  const activeAnalysisLink = page.locator('aside.app-sidebar a[data-active="true"]')
  await expect(activeAnalysisLink).toHaveCount(1)
  await expect(activeAnalysisLink).toHaveAttribute('href', /\/analyses(?:[?#]|$)/)
  await expect(page.locator('aside.app-sidebar a[href^="/analyses/runs"]')).not.toHaveAttribute('data-active', 'true')
})

test('code-comprehension deep link rejects a repository ID that disagrees with the snapshot', async ({ page }) => {
  const seed = seedDemo()
  await login(page, seed)

  const wrongRepositoryId = '00000000-0000-4000-8000-000000000998'
  await page.goto(
    `/repositories/${wrongRepositoryId}/snapshots/${seed.snapshotId}/artifacts/${seed.artifactId}`,
  )

  await expect(page.getByRole('heading', { name: 'This artifact belongs to a different repository' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open snapshot repository' }))
    .toHaveAttribute('href', `/repositories/${seed.repositoryId}`)
  await expect(page.getByText('Static evidence only', { exact: true })).not.toBeVisible()
})
