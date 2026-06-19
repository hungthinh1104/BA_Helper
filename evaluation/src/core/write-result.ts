import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { writeJsonFile, resolveRepoPath } from '../../io';
import { writeLegacyAlias } from './legacy-alias';

export interface WriteResultParams<T> {
  canonicalJsonPath?: string;
  canonicalMarkdownPath?: string;
  legacyJsonPath?: string;
  legacyMarkdownPath?: string;
  jsonData?: T;
  markdownData?: string;
  runId?: string;
  relativeArtifactPath?: string;
}

/**
 * Writes canonical result outputs and automatically creates legacy aliases.
 * Scripts must use this helper instead of manually copying files.
 */
export function writeResult<T>(params: WriteResultParams<T>): void {
  if (params.runId && !params.relativeArtifactPath) {
    throw new Error('relativeArtifactPath is required when runId is provided');
  }

  // Canonical paths write
  if (params.canonicalJsonPath && params.jsonData !== undefined) {
    writeJsonFile(params.canonicalJsonPath, params.jsonData);
    if (params.legacyJsonPath) {
      writeLegacyAlias(params.canonicalJsonPath, params.legacyJsonPath);
    }
  }

  if (params.canonicalMarkdownPath && params.markdownData !== undefined) {
    writeFileSync(resolveRepoPath(params.canonicalMarkdownPath), params.markdownData, 'utf8');
    if (params.legacyMarkdownPath) {
      writeLegacyAlias(params.canonicalMarkdownPath, params.legacyMarkdownPath);
    }
  }

  // Run-scoped mirror write
  if (params.runId && params.relativeArtifactPath) {
    const runScopedBaseDir = resolveRepoPath(`evaluation/results/v0/runs/${params.runId}`);
    
    if (params.jsonData !== undefined) {
      const runScopedJsonPath = `${runScopedBaseDir}/${params.relativeArtifactPath}`;
      mkdirSync(dirname(runScopedJsonPath), { recursive: true });
      writeFileSync(runScopedJsonPath, `${JSON.stringify(params.jsonData, null, 2)}\n`, 'utf8');
    }

    if (params.markdownData !== undefined) {
      const markdownRelativePath = params.relativeArtifactPath.replace(/\.json$/, '.md');
      const runScopedMdPath = `${runScopedBaseDir}/${markdownRelativePath}`;
      mkdirSync(dirname(runScopedMdPath), { recursive: true });
      writeFileSync(runScopedMdPath, params.markdownData, 'utf8');
    }
  }
}
