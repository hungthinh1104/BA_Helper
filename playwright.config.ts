import { defineConfig, devices, type ReporterDescription } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import {
  assertPrestartedPlaywrightNamespace,
  redisUrlIdentityOnly,
  validateTestTargets,
} from './apps/api/test/e2e/helpers/test-target-safety'

config({ path: '.env.test', quiet: true })
config({ path: '.env', quiet: true })
process.env.BA_HELPER_DEVELOPMENT_REDIS_URL = redisUrlIdentityOnly(
  process.env.BA_HELPER_DEVELOPMENT_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/0',
)
const testTargets = validateTestTargets(process.env)
assertPrestartedPlaywrightNamespace(process.env)
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
process.env.REDIS_URL = process.env.REDIS_URL_TEST
const queuePrefixIsGenerated = process.env.PW_PRESTARTED_SERVERS !== '1'
if (queuePrefixIsGenerated) {
  process.env.BULLMQ_PREFIX = `ba-helper-playwright-${randomUUID()}`
}

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
 * when those are occupied. Managed runs use an isolated queue prefix and own
 * their API/web ports. Use PW_PRESTARTED_SERVERS=1 with a matching prefix to
 * run against an already-started API, worker, and web server.
 */
const WEB_PORT = process.env.PW_WEB_PORT ?? '3000'
const API_PORT = process.env.PW_API_PORT ?? '3001'
const BASE_URL = `http://localhost:${WEB_PORT}`
const WEB_DIST_DIR = process.env.PW_WEB_DIST_DIR ?? '.next/g1-playwright'
const BROWSER_TSCONFIG_PATH = '.next/verify-change/tsconfig.json'
const NODE_COMMAND = `"${process.execPath}"`
process.env.NEXTAUTH_URL = BASE_URL
const browserRedisUrl = new URL(process.env.PW_REDIS_URL ?? process.env.REDIS_URL_TEST!)
const browserRedisDb = browserRedisUrl.pathname.replace(/^\//, '') || '0'
if (browserRedisUrl.hostname.toLowerCase() !== testTargets.redis.host || Number(browserRedisUrl.port || (browserRedisUrl.protocol === 'rediss:' ? 6380 : 6379)) !== testTargets.redis.port || Number(browserRedisDb) !== testTargets.redis.database) {
  throw new Error('PW_REDIS_URL must match REDIS_URL_TEST for browser runs.')
}
process.env.REDIS_URL = browserRedisUrl.toString()

if (queuePrefixIsGenerated) {
  const browserTsConfigFile = path.resolve(process.cwd(), 'apps/web', BROWSER_TSCONFIG_PATH)
  mkdirSync(path.dirname(browserTsConfigFile), { recursive: true })
  writeFileSync(browserTsConfigFile, `${JSON.stringify({ extends: '../../tsconfig.json' }, null, 2)}\n`)
}

const webServers = [
  {
    command: `${NODE_COMMAND} node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts && ${NODE_COMMAND} -r ts-node/register -r tsconfig-paths/register src/main.ts`,
    cwd: 'apps/api',
    env: {
      PORT: API_PORT,
      CORS_ALLOWED_ORIGINS: [process.env.CORS_ALLOWED_ORIGINS, BASE_URL].filter(Boolean).join(','),
      TS_NODE_PROJECT: 'tsconfig.json',
      TS_NODE_TRANSPILE_ONLY: 'true',
    } as Record<string, string>,
    url: `http://localhost:${API_PORT}/api/v1/system/live`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI && !queuePrefixIsGenerated,
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
    env: {
      INTERNAL_API_URL: `http://localhost:${API_PORT}`,
      NEXT_BUILD_DIST_DIR: WEB_DIST_DIR,
      NEXT_TSCONFIG_PATH: BROWSER_TSCONFIG_PATH,
    } as Record<string, string>,
    url: `${BASE_URL}/login`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI && !queuePrefixIsGenerated,
  },
]

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: './e2e/.artifacts/report', open: 'never' }],
]
if (process.env.VERIFY_CHANGE_PLAYWRIGHT_REPORT) {
  reporters.push(['json', { outputFile: process.env.VERIFY_CHANGE_PLAYWRIGHT_REPORT }])
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  outputDir: './e2e/.artifacts/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: reporters,
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
      testMatch: /(analysis-list-retry|decision-to-report|decision-keyboard|auth-headers|api-documentation|code-comprehension-trace|pinned-real-comprehension|route-smoke|responsive-sweep|multi-repo-review)\.pw\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(analysis-list-retry|decision-mobile|multi-repo-review)\.pw\.ts/,
    },
  ],
  webServer: process.env.PW_PRESTARTED_SERVERS === '1' ? [] : webServers,
})
