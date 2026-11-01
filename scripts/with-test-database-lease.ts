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
  let requestedSignal: NodeJS.Signals | undefined;
  let lostLease = false;
  let terminatePromise: Promise<void> | undefined;
  let heartbeatPromise = Promise.resolve();
  const stop = (signal: NodeJS.Signals) => {
    stopRequested = true;
    requestedSignal = signal;
    if (child) terminatePromise ??= terminateOwned(child, signal);
  };
  const onSigint = () => stop('SIGINT');
  const onSigterm = () => stop('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    child = spawn(command.file, command.args, { cwd: command.cwd, env: childEnvironment, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: 'inherit' });
    if (stopRequested) terminatePromise ??= terminateOwned(child, 'SIGINT');
    const heartbeat = setInterval(() => {
      heartbeatPromise = assertTestDatabaseLeaseClaim(childEnvironment).catch(async () => {
        lostLease = true;
        if (child) terminatePromise ??= terminateOwned(child, 'SIGTERM');
        await terminatePromise;
      });
    }, 2000);
    heartbeat.unref();
    const result = await new Promise<{ code: number; signal: NodeJS.Signals | null }>((resolve) => {
      child!.once('error', () => resolve({ code: 127, signal: null }));
      child!.once('close', (code, signal) => resolve({ code: code ?? (signal ? 128 : 1), signal }));
    }).finally(() => clearInterval(heartbeat));
    await heartbeatPromise;
    await terminatePromise;
    if (lostLease) throw new Error('Test database lease was lost; the owned child was stopped.');
    if (stopRequested) return requestedSignal === 'SIGTERM' ? 143 : 130;
    return result.code;
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    await terminatePromise;
    await release?.();
  }
}

function terminateOwned(child: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      taskkill.once('error', finish);
      taskkill.once('close', finish);
      child.kill();
    });
  }
  const closed = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('close', () => resolve());
  });
  try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
  return Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 3000))])
    .then(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        await closed;
      }
    });
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`[test-db-lease] ${error instanceof Error ? error.message : 'Test database lease failed'}\n`);
  process.exitCode = 1;
});
