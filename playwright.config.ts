import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test', quiet: true })
config({ path: '.env', quiet: true })
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
if (process.env.REDIS_URL_TEST) process.env.REDIS_URL = process.env.REDIS_URL_TEST

/**
 * Browser E2E for the decision-first analysis workspace.
 *
 * Files use the `.pw.ts` suffix and live under ./e2e so the repo-wide Jest
 * Browser tests use `.pw.ts` files, separate from the repo-wide Jest specs.
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
const WEB_DIST_DIR = '.next/g1-playwright'
const NODE_COMMAND = `"${process.execPath}"`
process.env.NEXTAUTH_URL = BASE_URL
const browserRedisUrl = new URL(process.env.PW_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379')
if (!process.env.PW_REDIS_URL) browserRedisUrl.pathname = '/1'
process.env.REDIS_URL = browserRedisUrl.toString()

const webServers = [
  {
    command: `${NODE_COMMAND} -r ts-node/register -r tsconfig-paths/register src/main.ts`,
    cwd: 'apps/api',
    env: { PORT: API_PORT, TS_NODE_PROJECT: 'tsconfig.json', TS_NODE_TRANSPILE_ONLY: 'true' } as Record<string, string>,
    url: `http://localhost:${API_PORT}/api/v1/system/live`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  {
    command: `${NODE_COMMAND} -r ts-node/register -r tsconfig-paths/register src/main.ts`,
    cwd: 'apps/worker',
    env: { TS_NODE_PROJECT: 'tsconfig.json', TS_NODE_TRANSPILE_ONLY: 'true' } as Record<string, string>,
    wait: { stdout: /"event":"WORKER_READY"/ },
    timeout: 120_000,
  },
  {
    command: `${NODE_COMMAND} node_modules/next/dist/bin/next dev --webpack -p ${WEB_PORT}`,
    cwd: 'apps/web',
    env: { INTERNAL_API_URL: `http://localhost:${API_PORT}`, NEXT_BUILD_DIST_DIR: WEB_DIST_DIR } as Record<string, string>,
    url: `${BASE_URL}/login`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
]

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
      testMatch: /(analysis-list-retry|decision-to-report|decision-keyboard|auth-headers|api-documentation|code-comprehension-trace|pinned-real-comprehension|route-smoke|responsive-sweep)\.pw\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(analysis-list-retry|decision-mobile)\.pw\.ts/,
    },
  ],
  webServer: process.env.PW_PRESTARTED_SERVERS === '1' ? [] : webServers,
})
