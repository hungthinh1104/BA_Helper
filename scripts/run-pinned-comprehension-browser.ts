import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from 'dotenv';
import { resolvePinnedBrowserRunStatus } from './pinned-comprehension-browser-status';
import { isIsolatedPinnedTestDatabaseUrl } from './pinned-proof-environment';

const PROOF_PATH = path.resolve(process.env.PINNED_COMPREHENSION_PROOF_FILE ??
  'artifacts/evaluation/pinned-code-comprehension-proof.json');
const API_PORT = process.env.PW_API_PORT ?? '3001';
const WEB_PORT = process.env.PW_WEB_PORT ?? '3000';
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
type Server = {
  name: string; child: ChildProcess; exited: boolean; exitCode: number | null;
  spawnError?: Error; waitForExit: Promise<void>; resolveExit: () => void;
};

function startServer(name: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Server {
  const child = spawn(process.execPath, args, {
    cwd: path.resolve(cwd), env, stdio: 'inherit', windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let resolveExit = () => {};
  const waitForExit = new Promise<void>(resolve => { resolveExit = resolve; });
  const server: Server = { name, child, exited: false, exitCode: null, waitForExit, resolveExit };
  child.once('error', error => { server.spawnError = error; server.exited = true; server.resolveExit(); });
  child.once('exit', code => { server.exitCode = code; server.exited = true; server.resolveExit(); });
  return server;
}

async function waitUntilReady(server: Server, url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'No successful health response.';
  while (Date.now() < deadline) {
    if (server.spawnError) throw new Error(`${server.name} failed to start: ${server.spawnError.message}`);
    if (server.exited) throw new Error(`${server.name} exited before becoming ready (code ${server.exitCode}).`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`${server.name} did not become ready at ${url}: ${lastError}`);
}

async function stopServer(server: Server): Promise<void> {
  if (server.exited || !server.child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(server.child.pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true, timeout: 15_000,
    });
  } else {
    try { process.kill(-server.child.pid, 'SIGTERM'); } catch { server.child.kill('SIGTERM'); }
  }
  await Promise.race([server.waitForExit, delay(10_000)]);
  if (!server.exited) {
    if (process.platform === 'win32') server.child.kill();
    else {
      try { process.kill(-server.child.pid, 'SIGKILL'); } catch { server.child.kill('SIGKILL'); }
    }
    await Promise.race([server.waitForExit, delay(5_000)]);
  }
  if (!server.exited) throw new Error(`${server.name} did not stop after the browser proof.`);
}

function runPlaywright(env: NodeJS.ProcessEnv): Promise<number> {
  const child = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js', 'test', 'e2e/pinned-real-comprehension.pw.ts',
    '--project=desktop', '--repeat-each=5', '--reporter=line', '--global-timeout=600000',
  ], { cwd: process.cwd(), env, stdio: 'inherit', windowsHide: true });
  return new Promise(resolve => {
    let settled = false;
    const finish = (code: number) => { if (!settled) { settled = true; resolve(code); } };
    child.once('error', error => { process.stderr.write(`${error.message}\n`); finish(1); });
    child.once('exit', code => finish(code ?? 1));
  });
}

function persistRunResult(exitCode: number, cleanupSucceeded: boolean): 'PASSED' | 'FAILED' | 'INCOMPLETE' {
  if (!existsSync(PROOF_PATH)) throw new Error('The pinned browser proof artifact was not created.');
  const proof = JSON.parse(readFileSync(PROOF_PATH, 'utf8')) as {
    browserVerification?: { samples?: unknown[]; [key: string]: unknown };
    [key: string]: unknown;
  };
  const sampleCount = proof.browserVerification?.samples?.length ?? 0;
  const status = resolvePinnedBrowserRunStatus(exitCode, sampleCount, cleanupSucceeded);
  proof.browserVerification = { ...proof.browserVerification, status, commandExitCode: exitCode,
    serverCleanupStatus: cleanupSucceeded ? 'PASSED' : 'FAILED' };
  writeFileSync(PROOF_PATH, `${JSON.stringify(proof, null, 2)}\n`);
  return status;
}

async function main(): Promise<void> {
  config({ path: '.env.test', quiet: true });
  config({ path: '.env', quiet: true });
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!isIsolatedPinnedTestDatabaseUrl(databaseUrl)) {
    throw new Error('Pinned browser verification requires a local loopback ba_helper_test database.');
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = process.env.REDIS_URL_TEST ?? 'redis://localhost:6379/1';
  process.env.PW_REDIS_URL = process.env.REDIS_URL;
  process.env.NEXTAUTH_URL = WEB_URL;
  process.env.WORKSPACE_MODE ??= 'dev-single-user';
  process.env.ENABLE_DEV_LOGIN ??= 'true';
  process.env.TS_NODE_TRANSPILE_ONLY = 'true';
  process.env.REQUIRE_PINNED_COMPREHENSION_PROOF = '1';
  process.env.PINNED_BROWSER_PROOF_MODE = '1';
  process.env.PW_PRESTARTED_SERVERS = '1';
  process.env.NEXT_BUILD_DIST_DIR = `.next/g1-pinned-browser-${process.pid}-${Date.now()}`;
  process.env.NEXT_TSCONFIG_PATH = 'tsconfig.pinned-e2e.json';

  const servers: Server[] = [];
  let runnerExitCode = 1;
  let cleanupSucceeded = true;
  try {
    servers.push(startServer('API', ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/main.ts'],
      'apps/api', { ...process.env, PORT: API_PORT }));
    await waitUntilReady(servers[0], `${API_URL}/api/v1/system/live`, 120_000);
    servers.push(startServer('Next.js', ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', WEB_PORT],
      'apps/web', { ...process.env, INTERNAL_API_URL: API_URL }));
    await waitUntilReady(servers[1], `${WEB_URL}/login`, 180_000);
    runnerExitCode = await runPlaywright(process.env);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  } finally {
    for (const server of servers.slice().reverse()) {
      try { await stopServer(server); }
      catch (error) {
        cleanupSucceeded = false;
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    try {
      const status = persistRunResult(runnerExitCode, cleanupSucceeded);
      if (status !== 'PASSED') runnerExitCode = 1;
    } catch (error) {
      cleanupSucceeded = false;
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      runnerExitCode = 1;
    }
  }
  process.exitCode = runnerExitCode;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
