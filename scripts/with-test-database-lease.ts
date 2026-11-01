import * as dotenv from 'dotenv';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { assertTestDatabaseLeaseClaim, acquireTestDatabaseLease } from '../apps/api/test/e2e/helpers/test-database-lease';
import { validateTestTargets } from '../apps/api/test/e2e/helpers/test-target-safety';
import { resolveLeaseWrappedCommand } from './lib/verify-change/lease-command';

async function main(): Promise<number> {
  const root = path.resolve(__dirname, '..');
  dotenv.config({ path: path.join(root, '.env.test'), quiet: true });
  validateTestTargets(process.env);
  const childEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    REDIS_URL: process.env.REDIS_URL_TEST,
    BA_HELPER_DEVELOPMENT_REDIS_URL: process.env.BA_HELPER_DEVELOPMENT_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379/0',
    NODE_ENV: 'test',
    AI_PROVIDER: 'fake',
    EMBEDDING_PROVIDER: 'fake',
  };
  let release: (() => Promise<void>) | undefined;
  if (process.env.BA_HELPER_TEST_LEASE_ID) {
    await assertTestDatabaseLeaseClaim(childEnvironment);
  } else {
    const lease = await acquireTestDatabaseLease(process.env);
    Object.assign(childEnvironment, lease.environment);
    release = lease.release;
    await lease.assertHeld();
  }
  const command = resolveLeaseWrappedCommand(process.argv.slice(2), root, process.execPath, process.env.npm_execpath, process.cwd());
  let child: ChildProcess | undefined;
  let stopRequested = false;
  let lostLease = false;
  const stop = (signal: NodeJS.Signals) => {
    stopRequested = true;
    if (child) terminateOwned(child, signal);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    child = spawn(command.file, command.args, { cwd: command.cwd, env: childEnvironment, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: 'inherit' });
    const heartbeat = setInterval(() => {
      void assertTestDatabaseLeaseClaim(childEnvironment).catch(() => {
        lostLease = true;
        if (child) terminateOwned(child, 'SIGTERM');
      });
    }, 2000);
    heartbeat.unref();
    const result = await new Promise<{ code: number; signal: NodeJS.Signals | null }>((resolve) => {
      child!.once('error', () => resolve({ code: 127, signal: null }));
      child!.once('close', (code, signal) => resolve({ code: code ?? (signal ? 128 : 1), signal }));
    }).finally(() => clearInterval(heartbeat));
    if (lostLease) throw new Error('Test database lease was lost; the owned child was stopped.');
    if (stopRequested) return result.signal === 'SIGTERM' ? 143 : 130;
    return result.code;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await release?.();
  }
}

function terminateOwned(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
    taskkill.unref();
  } else {
    try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
  }
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`[test-db-lease] ${error instanceof Error ? error.message : 'Test database lease failed'}\n`);
  process.exitCode = 1;
});
