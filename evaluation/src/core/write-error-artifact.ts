import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { writeJsonFile, resolveRepoPath } from '../../io';

export type ErrorArtifactStatus = 'NO_DATABASE_URL' | 'DB_UNAVAILABLE' | 'PIPELINE_ERROR' | 'VALIDATION_ERROR';

export interface WriteErrorArtifactOptions {
  runId: string;
  name: string;
  status: ErrorArtifactStatus;
  message: string;
  cause?: unknown;
  affectedCanonicalArtifacts?: string[];
  preservedCanonicalArtifacts?: string[];
}

/**
 * Writes an error artifact to the errors directory and run-scoped history.
 * Ensures that error artifacts do NOT overwrite stable canonical success artifacts.
 */
export function writeErrorArtifact(options: WriteErrorArtifactOptions): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    runId: options.runId,
    name: options.name,
    status: options.status,
    message: options.message,
    cause: options.cause,
    affectedCanonicalArtifacts: options.affectedCanonicalArtifacts,
    preservedCanonicalArtifacts: options.preservedCanonicalArtifacts,
  };

  // 1. Write to evaluation/results/v0/errors/<name>.<runId>.error.json
  const errorsDir = resolveRepoPath('evaluation/results/v0/errors');
  mkdirSync(errorsDir, { recursive: true });
  const canonicalErrorPath = `${errorsDir}/${options.name}.${options.runId}.error.json`;
  writeFileSync(canonicalErrorPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  // 2. Write to evaluation/results/v0/runs/<runId>/errors/<name>.error.json
  const runScopedDir = resolveRepoPath(`evaluation/results/v0/runs/${options.runId}/errors`);
  mkdirSync(runScopedDir, { recursive: true });
  const runScopedErrorPath = `${runScopedDir}/${options.name}.error.json`;
  writeFileSync(runScopedErrorPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
