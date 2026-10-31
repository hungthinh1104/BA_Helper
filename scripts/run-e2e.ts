import * as dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateTestTargets } from '../apps/api/test/e2e/helpers/test-target-safety';
import { prepareTestDatabaseSchema } from '../apps/api/test/e2e/helpers/prepare-test-env';

interface E2ERunEvidence {
  schemaPreparationCalls: number;
  schemaPreparationMs: number;
  jestExitCode: number | null;
  jestDurationMs?: number;
  status: 'RUNNING' | 'PASS' | 'FAIL' | 'INTERRUPTED';
}

async function main(): Promise<number> {
  dotenv.config({ path: path.resolve('.env.test'), quiet: true });
  validateTestTargets(process.env);
  const root = process.cwd();
  const reportRoot = process.env.VERIFY_CHANGE_REPORT_DIR || path.join(root, 'artifacts/evaluation/api-e2e');
  const runDirectory = path.join(reportRoot, `run-${new Date().toISOString().replace(/:/g, '-')}-${process.pid}`);
  await mkdir(runDirectory, { recursive: true });
  const evidencePath = path.join(runDirectory, 'e2e-setup.json');
  const evidence: E2ERunEvidence = { schemaPreparationCalls: 0, schemaPreparationMs: 0, jestExitCode: null, status: 'RUNNING' };
  await persist(evidencePath, evidence);

  const setupStart = Date.now();
  try {
    await prepareTestDatabaseSchema(process.env.DATABASE_URL_TEST!);
    evidence.schemaPreparationCalls = 1;
    evidence.schemaPreparationMs = Date.now() - setupStart;
  } catch (error) {
    evidence.status = 'FAIL';
    evidence.schemaPreparationMs = Date.now() - setupStart;
    evidence.jestExitCode = 1;
    await persist(evidencePath, evidence);
    throw error;
  }
  await persist(evidencePath, evidence);

  const jsonReport = process.env.VERIFY_CHANGE_JEST_REPORT || path.join(runDirectory, 'jest-e2e.json');
  const testEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_TEST,
    REDIS_URL: process.env.REDIS_URL_TEST,
    BA_HELPER_DEVELOPMENT_REDIS_URL: process.env.BA_HELPER_DEVELOPMENT_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379/0',
    BA_HELPER_E2E_SCHEMA_PREPARED: '1',
    NODE_ENV: 'test',
    AI_PROVIDER: 'fake',
    EMBEDDING_PROVIDER: 'fake',
  };
  const args = [path.join(root, 'node_modules/jest/bin/jest.js'), '--config', 'jest.e2e.config.ts', '--runInBand', '--json', '--outputFile', jsonReport, ...process.argv.slice(2)];
  const started = Date.now();
  const code = await runOwnedChild(process.execPath, args, testEnv, root);
  evidence.jestExitCode = code;
  evidence.jestDurationMs = Date.now() - started;
  evidence.status = code === 0 ? 'PASS' : code === 130 || code === 143 ? 'INTERRUPTED' : 'FAIL';
  await persist(evidencePath, evidence);
  return code;
}

function runOwnedChild(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32' });
    let interrupted = false;
    let spawnFailed = false;
    const stop = (signal: NodeJS.Signals) => {
      interrupted = true;
      if (child.pid) {
        if (process.platform === 'win32') {
          const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, shell: false });
          taskkill.unref();
        } else {
          try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
        }
      }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', () => { spawnFailed = true; });
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      resolve(interrupted ? (signal === 'SIGTERM' ? 143 : 130) : spawnFailed ? 127 : code ?? 1);
    });
  });
}

async function persist(file: string, evidence: E2ERunEvidence): Promise<void> {
  await writeFile(file, `${JSON.stringify({ ...evidence, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`[api-e2e] ${error instanceof Error ? error.message : 'E2E preparation failed'}\n`);
  process.exitCode = 1;
});
