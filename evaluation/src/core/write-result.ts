import { writeFileSync } from 'fs';
import { writeJsonFile, resolveRepoPath } from '../../io';
import { writeLegacyAlias } from './legacy-alias';

export interface WriteResultParams<T> {
  canonicalJsonPath?: string;
  canonicalMarkdownPath?: string;
  legacyJsonPath?: string;
  legacyMarkdownPath?: string;
  jsonData?: T;
  markdownData?: string;
}

/**
 * Writes canonical result outputs and automatically creates legacy aliases.
 * Scripts must use this helper instead of manually copying files.
 */
export function writeResult<T>(params: WriteResultParams<T>): void {
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
}
