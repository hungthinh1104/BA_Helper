import { closeSync, fsyncSync, linkSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { ScanArtifact } from '../packages/analyzer/src/scanner/scanner.types';
import { importJestRuntimeTrace, JEST_RUNTIME_TRACE_LIMITS } from '../packages/analyzer/src/runtime/jest-runtime-trace';

const args = readArguments(process.argv.slice(2));
const reportPath = resolve(required(args, 'jest-json'));
const staticIndexPath = resolve(required(args, 'static-index'));
const outputPath = resolve(required(args, 'output'));
const repoRoot = resolve(required(args, 'repo-root'));
const reportText = readBounded(reportPath, JEST_RUNTIME_TRACE_LIMITS.maxReportBytes);
const staticText = readBounded(staticIndexPath, JEST_RUNTIME_TRACE_LIMITS.maxReportBytes);
const staticArtifacts = readStaticArtifacts(staticText);
if (args['column-base'] && args['column-base'] !== '0' && args['column-base'] !== '1') {
  throw new Error('--column-base must be either 0 or 1.');
}
const trace = importJestRuntimeTrace(reportText, {
  repoRoot,
  commitSha: required(args, 'commit-sha'),
  staticSnapshotCommitSha: required(args, 'static-commit-sha'),
  staticArtifacts,
  ...(args['run-id'] ? { runId: args['run-id'] } : {}),
  ...(args['column-base'] === '0' || args['column-base'] === '1'
    ? { locationColumnBase: Number(args['column-base']) as 0 | 1 } : {}),
});
writeNewFile(outputPath, `${JSON.stringify(trace, null, 2)}\n`);
process.stdout.write(`Imported ${trace.observations.length} runtime case observations (${trace.importStatus}); run ${trace.runId}.\n`);

function readArguments(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (!name.startsWith('--') || !values[index + 1] || values[index + 1].startsWith('--')) {
      throw new Error('Expected --name value arguments.');
    }
    result[name.slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

function required(values: Record<string, string>, name: string): string {
  const value = values[name];
  if (!value) throw new Error(`Missing required --${name}.`);
  return value;
}

function readBounded(filePath: string, maxBytes: number): string {
  if (statSync(filePath).size > maxBytes) throw new RangeError('Input file exceeds the configured byte limit.');
  return readFileSync(filePath, 'utf8');
}

function readStaticArtifacts(source: string): ScanArtifact[] {
  const value: unknown = JSON.parse(source);
  const artifacts = Array.isArray(value) ? value
    : typeof value === 'object' && value !== null && 'artifacts' in value && Array.isArray(value.artifacts)
      ? value.artifacts : undefined;
  if (!artifacts) throw new TypeError('Static index must be an array or contain an artifacts array.');
  return artifacts as ScanArtifact[];
}

function writeNewFile(filePath: string, content: string): void {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  const descriptor = openSync(temporaryPath, 'wx', 0o600);
  try {
    const buffer = Buffer.from(content, 'utf8');
    if (buffer.byteLength > JEST_RUNTIME_TRACE_LIMITS.maxReportBytes) {
      throw new RangeError('Imported runtime trace exceeds the configured output limit.');
    }
    writeFileSync(descriptor, buffer);
    fsyncSync(descriptor);
  } catch (error) {
    closeSync(descriptor);
    unlinkSync(temporaryPath);
    throw error;
  }
  closeSync(descriptor);
  try {
    linkSync(temporaryPath, filePath);
  } finally {
    unlinkSync(temporaryPath);
  }
}
