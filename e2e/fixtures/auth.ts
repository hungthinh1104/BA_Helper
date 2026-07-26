import { type Page } from '@playwright/test'

/**
 * Logs in through the real NextAuth credentials form (POST /api/v1/auth/login).
 * On success useAuth.login does window.location.assign("/"), landing on the app
 * home, which mounts ProjectProvider (auto-selecting the single project) before
 * any deep-link to an analysis.
 */
export async function login(page: Page, creds: { email: string; password: string }): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', creds.email)
  await page.fill('#password', creds.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
  await page.waitForLoadState('networkidle').catch(() => undefined)
}
