import { expect, type Page } from '@playwright/test'

/**
 * Logs in through the real NextAuth credentials form (POST /api/v1/auth/login).
 * On success useAuth.login does window.location.assign("/"), landing on the app
 * home, which mounts ProjectProvider (auto-selecting the single project) before
 * any deep-link to an analysis.
 */
export async function login(
  page: Page,
  creds: { email: string; password: string; projectId?: string; projectName?: string },
): Promise<void> {
  await page.goto('/login')
  // Editable server-rendered inputs do not prove React has attached submit handlers.
  await expect(page.locator('form[data-client-ready="true"]')).toBeVisible({ timeout: 60_000 })
  const email = page.locator('#email')
  await expect(email).toBeEditable({ timeout: 60_000 })
  await email.fill(creds.email)
  await page.fill('#password', creds.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  const loginOutcome = await page.waitForFunction(() => {
    if (!window.location.pathname.includes('/login')) return 'authenticated'
    const formText = document.querySelector('form')?.textContent ?? ''
    const failure = formText.match(
      /Sign-in was rejected|Cannot reach the API server|Configured API URL points|Sign-in failed/,
    )?.[0]
    return failure ? `rejected: ${failure}` : false
  }, undefined, { timeout: 60_000 })
  const outcome = await loginOutcome.jsonValue() as string
  await loginOutcome.dispose()
  if (outcome !== 'authenticated') {
    throw new Error(`Browser sign-in failed: ${outcome}`)
  }
  await page.waitForLoadState('networkidle').catch(() => undefined)

  if (!creds.projectId || !creds.projectName) return

  const projectPicker = page.locator('header.app-topbar button:has(svg.lucide-folder-kanban)')
  await expect(projectPicker).toBeVisible()
  if (!(await projectPicker.innerText()).includes(creds.projectName)) {
    await projectPicker.click()
    const selection = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/workspace/select-project'),
    )
    await page.getByRole('menuitemradio').filter({ hasText: creds.projectName }).click()
    const response = await selection
    if (!response.ok()) {
      throw new Error(`Selecting the seeded project failed with HTTP ${response.status()}.`)
    }
    const selectedProject = await response.json() as { projectId?: string }
    if (selectedProject.projectId !== creds.projectId) {
      throw new Error('The workspace selected a different project than the E2E seed created.')
    }
  }
  await expect(projectPicker).toContainText(creds.projectName)
}
