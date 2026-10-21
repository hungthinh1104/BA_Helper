import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test', quiet: true })
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
if (process.env.REDIS_URL_TEST) process.env.REDIS_URL = process.env.REDIS_URL_TEST

/**
 * Browser E2E for the decision-first analysis workspace.
 *
 * Files use the `.pw.ts` suffix and live under ./e2e so the repo-wide Jest
 * `**​/*.spec.ts` match never sweeps them (and Playwright never runs the ~200
 * Jest specs). Boots live source (next dev / api dev) against the already-running
 * postgres+redis; the seeded review→finalize journey makes no AI calls, and
 * finalization enqueues deterministic report rendering in the real worker.
 *
 * Ports default to 3000 (web) / 3001 (api); override with PW_WEB_PORT / PW_API_PORT
 * when those are occupied (then boot the two dev servers on the same ports —
 * reuseExistingServer attaches to them).
 */
const WEB_PORT = process.env.PW_WEB_PORT ?? '3000'
const API_PORT = process.env.PW_API_PORT ?? '3001'
const BASE_URL = `http://localhost:${WEB_PORT}`
process.env.NEXTAUTH_URL = BASE_URL
const browserRedisUrl = new URL(process.env.PW_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379')
if (!process.env.PW_REDIS_URL) browserRedisUrl.pathname = '/1'
process.env.REDIS_URL = browserRedisUrl.toString()

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
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 90_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
      testMatch: /(decision-to-report|decision-keyboard|auth-headers|api-documentation)\.pw\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /decision-mobile\.pw\.ts/,
    },
  ],
  webServer: [
    {
      command: `pnpm exec dotenv -v PORT=${API_PORT} -v TS_NODE_TRANSPILE_ONLY=true -- pnpm dev:api`,
      url: `http://localhost:${API_PORT}/api/v1/system/live`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm exec dotenv -v TS_NODE_TRANSPILE_ONLY=true -- pnpm dev:worker',
      wait: { stdout: /"event":"WORKER_READY"/ },
      timeout: 120_000,
    },
    {
      command: `pnpm exec dotenv -e .env -v INTERNAL_API_URL=http://localhost:${API_PORT} -- pnpm --dir apps/web exec next dev --webpack -p ${WEB_PORT}`,
      url: `${BASE_URL}/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
