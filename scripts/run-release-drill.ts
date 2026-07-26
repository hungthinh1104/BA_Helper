/**
 * Executable controlled-beta release drill.
 *
 * Replaces the hand-written startup/restore drill runbooks
 * (docs/runbooks/production-startup-drill-*.md, restore-drill-*.md) with a
 * script that actually builds the production images, boots the production
 * compose profile in isolation, exercises the release-critical properties, and
 * emits machine-readable evidence to
 * artifacts/release/production-release-drill.json.
 *
 * What it proves (no external AI provider required):
 *   - images-built           the three app images build from the documented Dockerfiles
 *   - stack-boot             the production profile boots (dev-login off, Redis auth, real-provider selection)
 *   - migrations-applied     prisma migrate deploy ran against the fresh production database
 *   - dev-login-disabled     POST /auth/dev-login is refused in production
 *   - health-live            /system/live is process-only and leaks no operational data
 *   - health-ready           /system/ready reports dependency up/down only (no workspace mode, no counts)
 *   - operations-admin-gated /system/operations is 401/403 without an ADMIN token
 *   - boot-guard-fails-closed a weak REDIS_URL is rejected at boot (fails closed)
 *   - web-login-200          the web login page serves
 *   - restart-survival       api + worker survive a restart with persisted state
 *   - backup-restore         a logical pg_dump restores into a temporary database with data + pgvector
 *
 * The live scan -> analyze -> finalize -> export leg needs a real AI provider
 * (the production boot guard forbids the fake provider), so it is out of scope
 * here and recorded as SKIPPED, never fabricated. That path is covered
 * deterministically by `pnpm verify:analyzer-quality` and `pnpm demo:golden-path`.
 *
 * Usage:
 *   pnpm tsx scripts/run-release-drill.ts          # full drill
 *   pnpm tsx scripts/run-release-drill.ts --print-plan   # list checks, no Docker
 *   RELEASE_DRILL_SKIP_BUILD=1 ...                 # reuse cached images (debug)
 *   RELEASE_DRILL_KEEP=1 ...                       # leave the stack up (debug)
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const PROJECT = 'ba-helper-release-drill';
const COMPOSE_FILES = ['-f', 'docker-compose.yml', '-f', 'docker-compose.production.yml'];
// Host ports for the drill's api/web are chosen at runtime (free ephemeral
// ports) so the drill never collides with a dev server or another host process.
let API_PORT = 0;
let WEB_PORT = 0;
let API = '';
let WEB = '';
const OUT_DIR = path.join(ROOT, 'artifacts/release');
const OUT_FILE = path.join(OUT_DIR, 'production-release-drill.json');
const ENV_FILE = path.join(os.tmpdir(), `ba-helper-release-drill-${crypto.randomBytes(6).toString('hex')}.env`);
const RESTORE_DB = 'ba_helper_release_drill_restore';

const SKIP_BUILD = process.env.RELEASE_DRILL_SKIP_BUILD === '1';
const KEEP = process.env.RELEASE_DRILL_KEEP === '1';
const PRINT_PLAN = process.argv.includes('--print-plan');

type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';
interface Check {
  id: string;
  status: CheckStatus;
  detail: string;
  durationMs: number;
  command?: string;
  evidence?: Record<string, unknown>;
}
interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

class DrillError extends Error {}

const PLANNED_CHECKS = [
  'images-built',
  'stack-boot',
  'migrations-applied',
  'dev-login-disabled',
  'health-live',
  'health-ready',
  'operations-admin-gated',
  'boot-guard-fails-closed',
  'web-login-200',
  'restart-survival',
  'backup-restore',
  'live-analysis',
];

const checks: Check[] = [];
const images: Array<{ service: string; id: string; tag: string }> = [];
let DB_PASSWORD = '';
let DRILL_ENV: Record<string, string> = {};

function record(check: Check): void {
  checks.push(check);
  const mark = check.status === 'PASS' ? 'PASS' : check.status === 'SKIPPED' ? 'SKIP' : 'FAIL';
  console.log(`[${mark}] ${check.id} — ${check.detail}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exec(
  file: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string } = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd: ROOT, env: opts.env ?? process.env });
    let stdout = '';
    let stderr = '';
    const timer = opts.timeoutMs
      ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs)
      : null;
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}${String(err)}` });
    });
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}

function compose(args: string[], timeoutMs = 20 * 60_000): Promise<ExecResult> {
  // Pass the drill env into the compose process so its values win over any
  // ambient shell env (e.g. CI's AI_PROVIDER=fake or a weak REDIS_URL), which
  // otherwise takes precedence over --env-file during compose interpolation.
  return exec(
    'docker',
    ['compose', '--env-file', ENV_FILE, ...COMPOSE_FILES, '-p', PROJECT, ...args],
    { timeoutMs, env: { ...process.env, ...DRILL_ENV } },
  );
}

/** Exec inside the drill's postgres container with PGPASSWORD injected. */
function pgExec(inner: string[], timeoutMs = 2 * 60_000): Promise<ExecResult> {
  return compose(['exec', '-T', '-e', `PGPASSWORD=${DB_PASSWORD}`, 'postgres', ...inner], timeoutMs);
}

/** Run a psql query inside the drill's postgres container against `db`. */
async function psql(sql: string, db = 'ba_helper'): Promise<string> {
  const r = await pgExec(['psql', '-U', 'ba_helper', '-d', db, '-tAc', sql]);
  if (r.code !== 0) throw new DrillError(`psql failed (${sql}): ${r.stderr.trim() || r.stdout.trim()}`);
  return r.stdout.trim();
}

/** Ask the OS for a free ephemeral port on the loopback interface. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

interface HttpResult {
  status: number;
  body: string;
  json: unknown;
}

async function http(
  method: 'GET' | 'POST',
  url: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const body = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(body);
    } catch {
      json = null;
    }
    return { status: res.status, body, json };
  } catch (error) {
    return { status: 0, body: String(error), json: null };
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor<T>(
  fn: () => Promise<T | null>,
  opts: { timeoutMs: number; intervalMs?: number; label: string },
): Promise<T> {
  const interval = opts.intervalMs ?? 3000;
  const deadline = Date.now() + opts.timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch (error) {
      last = String(error);
    }
    await sleep(interval);
  }
  throw new DrillError(`Timed out waiting for ${opts.label}${last ? ` (${last})` : ''}`);
}

function strongSecret(): string {
  // base64url is URL-safe, so it can be embedded in DATABASE_URL/REDIS_URL, and
  // is never a value in the weak-secret denylist.
  return crypto.randomBytes(36).toString('base64url');
}

async function writeEnvFile(): Promise<Record<string, string>> {
  const postgresPassword = strongSecret();
  DB_PASSWORD = postgresPassword;
  const redisPassword = strongSecret();
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    WORKSPACE_MODE: 'dev-single-user',
    ENABLE_DEV_LOGIN: 'false',
    PUBLIC_PREVIEW_MODE: 'false',
    POSTGRES_PASSWORD: postgresPassword,
    DATABASE_URL: `postgresql://ba_helper:${postgresPassword}@postgres:5432/ba_helper`,
    REDIS_PASSWORD: redisPassword,
    REDIS_URL: `redis://:${redisPassword}@redis:6379`,
    JWT_SECRET: strongSecret(),
    NEXTAUTH_SECRET: strongSecret(),
    API_HOST_PORT: String(API_PORT),
    WEB_HOST_PORT: String(WEB_PORT),
    CORS_ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
    NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
    INTERNAL_API_URL: 'http://api:3001',
    PUBLIC_BETA_RATE_LIMIT_ENABLED: 'true',
    PUBLIC_BETA_RATE_LIMIT_MAX: '30',
    PUBLIC_BETA_RATE_LIMIT_WINDOW_MS: '60000',
    // Real-provider adapter selection with a placeholder key: the prod boot
    // guard forbids the fake provider, and no external request is made during
    // the drill's boot/health checks.
    AI_PROVIDER: 'google',
    EMBEDDING_PROVIDER: 'google',
    GOOGLE_API_KEY: 'release-drill-placeholder-key-no-external-call',
    GOOGLE_MODEL: 'gemini-2.5-flash',
    BA_HELPER_PRESERVE_SCAN_WORKSPACE: 'false',
    NEXT_PUBLIC_USE_MOCK_API: 'false',
  };
  const contents = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  DRILL_ENV = env;
  await writeFile(ENV_FILE, `${contents}\n`, { mode: 0o600 });
  return env;
}

/**
 * Safety gate: refuse to run unless the resolved compose project is exactly the
 * isolated drill project. Protects the developer's running `ba-helper` stack —
 * if `-p` ever failed to override the compose file's top-level `name:`, the
 * drill's destructive `down -v` could target the dev database.
 */
async function assertProjectIsolation(): Promise<void> {
  const cfg = await compose(['config'], 2 * 60_000);
  if (cfg.code !== 0) {
    throw new DrillError(`compose config failed: ${cfg.stderr.trim().slice(-400)}`);
  }
  const match = /^name:\s*(.+)$/m.exec(cfg.stdout);
  const resolved = match ? match[1].trim() : '';
  if (resolved !== PROJECT) {
    throw new DrillError(
      `Refusing to run: resolved compose project is "${resolved}", expected "${PROJECT}". ` +
        'The drill must never operate on another compose project.',
    );
  }
}

// ---------------------------------------------------------------------------
// Steps. A hard-prerequisite failure throws DrillError to abort the sequence;
// everything downstream is then recorded SKIPPED before evidence is written.
// ---------------------------------------------------------------------------

async function stepBuild(): Promise<void> {
  const start = Date.now();
  if (SKIP_BUILD) {
    record({
      id: 'images-built',
      status: 'SKIPPED',
      detail: 'RELEASE_DRILL_SKIP_BUILD=1 — reusing cached images (debug).',
      durationMs: Date.now() - start,
    });
    return;
  }
  const command = `docker compose ${COMPOSE_FILES.join(' ')} -p ${PROJECT} build`;
  const built = await compose(['build']);
  if (built.code !== 0) {
    record({
      id: 'images-built',
      status: 'FAIL',
      detail: `Image build failed: ${built.stderr.trim().slice(-500)}`,
      durationMs: Date.now() - start,
      command,
    });
    throw new DrillError('image build failed');
  }
  record({
    id: 'images-built',
    status: 'PASS',
    detail: 'Production images built from the documented Dockerfiles (apps/{api,worker,web}).',
    durationMs: Date.now() - start,
    command,
  });
}

/**
 * Record the built image digests. Called after `up` — `compose images` reflects
 * the project's containers, so digests are only available once the stack exists.
 */
async function captureImages(): Promise<void> {
  for (const service of ['api', 'worker', 'web', 'migrate']) {
    const name = `${PROJECT}-${service}`;
    const inspected = await exec('docker', ['image', 'inspect', name, '--format', '{{.Id}}']);
    if (inspected.code === 0 && inspected.stdout.trim()) {
      images.push({ service, id: inspected.stdout.trim(), tag: `${name}:latest` });
    }
  }
}

async function stepBoot(): Promise<void> {
  const start = Date.now();
  const command = `docker compose ${COMPOSE_FILES.join(' ')} -p ${PROJECT} up -d`;
  const up = await compose(['up', '-d']);
  if (up.code !== 0) {
    record({
      id: 'stack-boot',
      status: 'FAIL',
      detail: `Stack failed to start: ${up.stderr.trim().slice(-500)}`,
      durationMs: Date.now() - start,
      command,
    });
    throw new DrillError('stack boot failed');
  }
  // api depends_on migrate: service_completed_successfully, so a live /system/live
  // implies migrations applied and the production boot guard passed.
  await waitFor(
    async () => {
      const res = await http('GET', `${API}/api/v1/system/live`);
      return res.status === 200 ? res : null;
    },
    { timeoutMs: 240_000, label: 'API liveness' },
  );
  await captureImages();
  const ps = await compose(['ps', '--format', 'json']);
  record({
    id: 'stack-boot',
    status: 'PASS',
    detail: 'Production profile booted; API reached liveness (dev-login off, Redis auth, real-provider selection).',
    durationMs: Date.now() - start,
    command,
    evidence: { images, ps: ps.stdout.trim().slice(0, 2000) },
  });
}

async function stepMigrations(): Promise<void> {
  const start = Date.now();
  const applied = Number(
    await psql("SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL"),
  );
  const failed = applied > 0;
  record({
    id: 'migrations-applied',
    status: failed ? 'PASS' : 'FAIL',
    detail: `${applied} migration(s) applied to the fresh production database.`,
    durationMs: Date.now() - start,
    evidence: { appliedMigrations: applied },
  });
  if (!failed) throw new DrillError('no migrations applied');
}

async function stepDevLoginDisabled(): Promise<void> {
  const start = Date.now();
  const res = await http('POST', `${API}/api/v1/auth/dev-login`, {
    body: { email: 'drill@local' },
  });
  const refused = !(res.status >= 200 && res.status < 300);
  record({
    id: 'dev-login-disabled',
    status: refused ? 'PASS' : 'FAIL',
    detail: `POST /auth/dev-login returned ${res.status} (dev login is refused in production).`,
    durationMs: Date.now() - start,
    evidence: { status: res.status },
  });
}

async function stepHealthLive(): Promise<void> {
  const start = Date.now();
  const res = await http('GET', `${API}/api/v1/system/live`);
  const body = (res.json ?? {}) as Record<string, unknown>;
  const ok = res.status === 200 && body.status === 'ok';
  const leaks = ['workspaceMode', 'queues', 'pending', 'running', 'failed'].filter(
    (key) => key in body,
  );
  record({
    id: 'health-live',
    status: ok && leaks.length === 0 ? 'PASS' : 'FAIL',
    detail: ok
      ? leaks.length === 0
        ? 'Liveness is process-only and leaks no operational data.'
        : `Liveness leaked operational fields: ${leaks.join(', ')}.`
      : `Liveness not ok (status ${res.status}).`,
    durationMs: Date.now() - start,
    evidence: { status: res.status, keys: Object.keys(body) },
  });
}

async function stepHealthReady(): Promise<void> {
  const start = Date.now();
  const res = await http('GET', `${API}/api/v1/system/ready`);
  const body = (res.json ?? {}) as Record<string, unknown>;
  const leaks = ['workspaceMode', 'pending', 'running', 'failed'].filter((key) => key in body);
  // Readiness must report dependency booleans without operational counts.
  const serialized = JSON.stringify(body).toLowerCase();
  const mentionsDeps = ['database', 'redis', 'queue', 'pgvector', 'vector'].some((dep) =>
    serialized.includes(dep),
  );
  const ok = res.status === 200 && leaks.length === 0 && mentionsDeps;
  record({
    id: 'health-ready',
    status: ok ? 'PASS' : 'FAIL',
    detail: ok
      ? 'Readiness reports dependency up/down only (no workspace mode, no queue counts).'
      : `Readiness check failed (status ${res.status}, leaks ${leaks.join(',') || 'none'}).`,
    durationMs: Date.now() - start,
    evidence: { status: res.status, keys: Object.keys(body), leaks },
  });
}

async function stepOperationsGated(): Promise<void> {
  const start = Date.now();
  const res = await http('GET', `${API}/api/v1/system/operations`);
  const gated = res.status === 401 || res.status === 403;
  record({
    id: 'operations-admin-gated',
    status: gated ? 'PASS' : 'FAIL',
    detail: `GET /system/operations without a token returned ${res.status} (ADMIN-gated; no public leak).`,
    durationMs: Date.now() - start,
    evidence: { status: res.status },
  });
}

async function stepBootGuard(): Promise<void> {
  const start = Date.now();
  const command = 'docker compose run --rm --no-deps -e REDIS_URL=redis://redis:6379 api';
  // A weak REDIS_URL must be rejected at boot before any connection is made.
  const run = await compose(
    ['run', '--rm', '--no-deps', '-e', 'REDIS_URL=redis://redis:6379', 'api'],
    3 * 60_000,
  );
  const output = `${run.stdout}\n${run.stderr}`;
  // Require the guard's own message — a non-zero exit for any other reason must
  // not count as a fail-closed pass.
  const guardPattern = /must not use a weak or default value|BOOT GUARD|FakeLlmProvider is forbidden/i;
  const guardLine = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => guardPattern.test(line));
  const rejected = run.code !== 0 && Boolean(guardLine);
  record({
    id: 'boot-guard-fails-closed',
    status: rejected ? 'PASS' : 'FAIL',
    detail: rejected
      ? 'Production boot guard rejected a weak REDIS_URL and exited non-zero (fails closed).'
      : `Boot guard did not fail closed (exit ${run.code}).`,
    durationMs: Date.now() - start,
    command,
    evidence: { exitCode: run.code, guardMessage: guardLine ?? output.trim().slice(-300) },
  });
}

async function stepWebLogin(): Promise<void> {
  const start = Date.now();
  const res = await waitFor(
    async () => {
      const r = await http('GET', `${WEB}/login`);
      return r.status === 200 ? r : null;
    },
    { timeoutMs: 120_000, label: 'web /login' },
  ).catch(() => null);
  record({
    id: 'web-login-200',
    status: res ? 'PASS' : 'FAIL',
    detail: res ? 'Web login page served HTTP 200.' : 'Web login page did not serve HTTP 200.',
    durationMs: Date.now() - start,
    evidence: { status: res?.status ?? 0 },
  });
}

async function stepRestartSurvival(): Promise<void> {
  const start = Date.now();
  const before = Number(await psql('SELECT count(*) FROM _prisma_migrations'));
  const restart = await compose(['restart', 'api', 'worker'], 3 * 60_000);
  if (restart.code !== 0) {
    record({
      id: 'restart-survival',
      status: 'FAIL',
      detail: `Restart failed: ${restart.stderr.trim().slice(-300)}`,
      durationMs: Date.now() - start,
    });
    return;
  }
  await waitFor(
    async () => {
      const res = await http('GET', `${API}/api/v1/system/live`);
      return res.status === 200 ? res : null;
    },
    { timeoutMs: 180_000, label: 'API liveness after restart' },
  );
  const after = Number(await psql('SELECT count(*) FROM _prisma_migrations'));
  const survived = after === before && after > 0;
  record({
    id: 'restart-survival',
    status: survived ? 'PASS' : 'FAIL',
    detail: survived
      ? `api + worker restarted and recovered; persisted state unchanged (${after} migrations).`
      : `Persisted state changed across restart (${before} -> ${after}).`,
    durationMs: Date.now() - start,
    evidence: { migrationsBefore: before, migrationsAfter: after },
  });
}

async function stepBackupRestore(): Promise<void> {
  const start = Date.now();
  // Seed a representative audit row as a restore witness (best-effort — the
  // migration ledger is the guaranteed witness even if the schema shifts).
  const eventKey = `release-drill:${crypto.randomBytes(6).toString('hex')}`;
  let seededEvent = false;
  try {
    await psql(
      `INSERT INTO "DomainEvent" (id, "eventType", "idempotencyKey", payload) ` +
        `VALUES ('${crypto.randomUUID()}', 'AUTH_LOGIN_SUCCEEDED', '${eventKey}', '{}'::jsonb)`,
    );
    seededEvent = true;
  } catch {
    seededEvent = false;
  }

  const migrationsBefore = Number(await psql('SELECT count(*) FROM _prisma_migrations'));

  // Dump (custom format) and restore into a throwaway database, entirely inside
  // the postgres container — no host ports, source database untouched.
  const script = [
    `dropdb -U ba_helper --if-exists ${RESTORE_DB}`,
    `pg_dump -U ba_helper -Fc ba_helper > /tmp/release-drill.dump`,
    `createdb -U ba_helper ${RESTORE_DB}`,
    `psql -U ba_helper -d ${RESTORE_DB} -c 'CREATE EXTENSION IF NOT EXISTS vector'`,
    `pg_restore -U ba_helper --no-owner --no-acl -d ${RESTORE_DB} /tmp/release-drill.dump`,
  ].join(' && ');
  const restore = await pgExec(['sh', '-lc', script], 5 * 60_000);
  if (restore.code !== 0) {
    record({
      id: 'backup-restore',
      status: 'FAIL',
      detail: `Backup/restore failed: ${restore.stderr.trim().slice(-400)}`,
      durationMs: Date.now() - start,
    });
    await psql(`DROP DATABASE IF EXISTS ${RESTORE_DB}`, 'postgres').catch(() => undefined);
    return;
  }

  const migrationsAfter = Number(
    await psql('SELECT count(*) FROM _prisma_migrations', RESTORE_DB),
  );
  const hasVector =
    (await psql("SELECT count(*) FROM pg_extension WHERE extname = 'vector'", RESTORE_DB)) === '1';
  const eventSurvived = seededEvent
    ? (await psql(
        `SELECT count(*) FROM "DomainEvent" WHERE "idempotencyKey" = '${eventKey}'`,
        RESTORE_DB,
      )) === '1'
    : true;

  // Cleanup temp database + dump.
  await compose(['exec', '-T', 'postgres', 'sh', '-lc', `dropdb -U ba_helper --if-exists ${RESTORE_DB}; rm -f /tmp/release-drill.dump`]).catch(
    () => undefined,
  );

  const ok =
    migrationsAfter === migrationsBefore && migrationsAfter > 0 && hasVector && eventSurvived;
  record({
    id: 'backup-restore',
    status: ok ? 'PASS' : 'FAIL',
    detail: ok
      ? `Logical backup restored into a temporary database: ${migrationsAfter} migrations, pgvector present${seededEvent ? ', seeded audit row survived' : ''}.`
      : `Restore verification failed (migrations ${migrationsBefore}->${migrationsAfter}, pgvector ${hasVector}, event ${eventSurvived}).`,
    durationMs: Date.now() - start,
    evidence: { migrationsBefore, migrationsAfter, hasVector, seededEvent, eventSurvived },
  });
}

async function stepLiveAnalysis(): Promise<void> {
  // The scan -> analyze -> finalize -> export path requires a real AI provider;
  // the production boot guard forbids the fake provider, so it cannot run in a
  // production boot without live credentials. It is covered deterministically by
  // `pnpm verify:analyzer-quality` and `pnpm demo:golden-path`, which run in the
  // same verification suite. Recorded as SKIPPED — never fabricated.
  record({
    id: 'live-analysis',
    status: 'SKIPPED',
    detail:
      'Live scan/analyze/finalize/export requires real AI provider credentials (prod boot guard forbids the fake provider); covered by verify:analyzer-quality + demo:golden-path.',
    durationMs: 0,
  });
}

async function cleanup(): Promise<void> {
  if (KEEP) {
    console.log(`RELEASE_DRILL_KEEP=1 — leaving project ${PROJECT} up.`);
  } else {
    await compose(['down', '-v', '--remove-orphans'], 5 * 60_000).catch(() => undefined);
  }
  await rm(ENV_FILE, { force: true }).catch(() => undefined);
}

function overallStatus(): 'PASS' | 'PASS_WITH_SKIPS' | 'FAIL' {
  if (checks.some((c) => c.status === 'FAIL')) return 'FAIL';
  if (checks.some((c) => c.status === 'SKIPPED')) return 'PASS_WITH_SKIPS';
  return 'PASS';
}

async function main(): Promise<void> {
  if (PRINT_PLAN) {
    console.log('Release drill checks:');
    for (const id of PLANNED_CHECKS) console.log(`  - ${id}`);
    return;
  }

  const startedAt = new Date().toISOString();
  const commitSha = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim();
  const dockerVersion = (await exec('docker', ['--version'])).stdout.trim();
  const composeVersion = (await exec('docker', ['compose', 'version', '--short'])).stdout.trim();

  const info = await exec('docker', ['info'], { timeoutMs: 15_000 });
  if (info.code !== 0) {
    throw new DrillError('Docker daemon is not available.');
  }
  // Pick free host ports so the drill never collides with a running dev server
  // or another host process holding 3000/3001.
  API_PORT = await findFreePort();
  WEB_PORT = await findFreePort();
  API = `http://127.0.0.1:${API_PORT}`;
  WEB = `http://127.0.0.1:${WEB_PORT}`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeEnvFile();
  await assertProjectIsolation();

  try {
    await stepBuild();
    await stepBoot();
    await stepMigrations();
    await stepDevLoginDisabled();
    await stepHealthLive();
    await stepHealthReady();
    await stepOperationsGated();
    await stepBootGuard();
    await stepWebLogin();
    await stepRestartSurvival();
    await stepBackupRestore();
    await stepLiveAnalysis();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Drill aborted: ${message}`);
    // Record any planned-but-unreached checks as SKIPPED (prerequisite failed).
    const reached = new Set(checks.map((c) => c.id));
    for (const id of PLANNED_CHECKS) {
      if (!reached.has(id)) {
        checks.push({
          id,
          status: 'SKIPPED',
          detail: 'Prerequisite step failed; check not reached.',
          durationMs: 0,
        });
      }
    }
  } finally {
    await cleanup();
  }

  const finishedAt = new Date().toISOString();
  const status = overallStatus();
  const evidence = {
    schemaVersion: 1,
    tool: 'run-release-drill',
    status,
    commitSha,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    project: PROJECT,
    host: { docker: dockerVersion, compose: composeVersion, node: process.version },
    images,
    checks,
    failures: checks.filter((c) => c.status === 'FAIL').map((c) => c.id),
    skipped: checks.filter((c) => c.status === 'SKIPPED').map((c) => c.id),
  };
  await writeFile(OUT_FILE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nRelease drill: ${status}`);
  console.log(`Evidence: ${path.relative(ROOT, OUT_FILE)}`);
  if (status === 'FAIL') process.exitCode = 1;
}

main().catch(async (error) => {
  await cleanup().catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
