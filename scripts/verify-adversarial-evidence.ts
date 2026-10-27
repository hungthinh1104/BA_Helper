import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ANALYZER_VERSION } from '@ba-helper/analyzer';
import { runAdversarialEvidenceVerification } from '../tests/evaluation/adversarial-evidence/runner';

const outputPath = path.resolve('artifacts/evaluation/adversarial-evidence-verification.json');

try {
  const report = { generatedAt: new Date().toISOString(), ...runAdversarialEvidenceVerification() };
  saveReport(report);
  console.log(`Adversarial evidence verification: ${report.status}`);
  console.log(JSON.stringify(report.metrics, null, 2));
  console.log(`Cases: ${report.cases.filter(item => item.passed).length}/${report.cases.length} passed`);
  console.log(`Runtime: ${report.durationMs} ms; analyzer: ${report.analyzerVersion}; tool: ${report.toolCommitSha}`);
  const failedCases = report.cases.filter(item => !item.passed);
  if (failedCases.length) console.error(JSON.stringify({ failedCases }, null, 2));
  console.log(`Report: ${path.relative(process.cwd(), outputPath)}`);
  if (report.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    toolCommitSha: gitHeadOrUnavailable(),
    toolWorkingTreeDirty: isWorkingTreeDirty(),
    analyzerVersion: ANALYZER_VERSION,
    verificationSuiteVersion: 'g2b-auto-lite-1',
    status: 'INFRASTRUCTURE_ERROR',
    error: { name: error instanceof Error ? error.name : 'UnknownError', message },
    limitations: ['Verification did not complete; no property result is claimed.'],
  };
  saveReport(report);
  console.error(`ADVERSARIAL_EVIDENCE_INFRASTRUCTURE_ERROR: ${message}`);
  console.error(`Report: ${path.relative(process.cwd(), outputPath)}`);
  process.exitCode = 2;
}

function saveReport(report: unknown): void {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function gitHeadOrUnavailable(): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return 'UNAVAILABLE'; }
}

function isWorkingTreeDirty(): boolean {
  try {
    return Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim());
  } catch { return true; }
}
