import { defineConfig, devices } from '@playwright/test'

/**
 * Browser E2E for the decision-first analysis workspace.
 *
 * Files use the `.pw.ts` suffix and live under ./e2e so the repo-wide Jest
 * `**​/*.spec.ts` match never sweeps them (and Playwright never runs the ~200
 * Jest specs). Boots live source (next dev / api dev) against the already-running
 * postgres+redis; the seeded review→finalize journey makes no AI calls, and
 * finalize is synchronous so no worker is needed.
 *
 * Ports default to 3000 (web) / 3001 (api); override with PW_WEB_PORT / PW_API_PORT
 * when those are occupied (then boot the two dev servers on the same ports —
 * reuseExistingServer attaches to them).
 */
const WEB_PORT = process.env.PW_WEB_PORT ?? '3000'
const API_PORT = process.env.PW_API_PORT ?? '3001'
const BASE_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './e2e/.artifacts/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: './e2e/.artifacts/report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    locale: 'en-US',
    trace: 'on-first-retry',
    navigationTimeout: 90_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
      testMatch: /(decision-to-report|decision-keyboard)\.pw\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /decision-mobile\.pw\.ts/,
    },
  ],
  webServer: [
    {
      command: `PORT=${API_PORT} pnpm dev:api`,
      url: `http://localhost:${API_PORT}/api/v1/system/live`,
      timeout: 120_000,
      reuseExistingServer: true,
    },
    {
      command: `INTERNAL_API_URL=http://localhost:${API_PORT} pnpm exec dotenv -e .env -- pnpm --dir apps/web exec next dev --webpack -p ${WEB_PORT}`,
      url: `${BASE_URL}/login`,
      timeout: 180_000,
      reuseExistingServer: true,
    },
  ],
})
