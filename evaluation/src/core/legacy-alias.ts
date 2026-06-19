import { existsSync, copyFileSync } from 'fs';
import { resolveRepoPath } from '../../io';

/**
 * Copies a canonical file to a legacy alias path for backwards compatibility.
 * This is a temporary measure and will be removed after E11/E12.
 */
export function writeLegacyAlias(canonicalPath: string, legacyAliasPath: string): void {
  const absoluteCanonical = resolveRepoPath(canonicalPath);
  const absoluteLegacy = resolveRepoPath(legacyAliasPath);

  if (!existsSync(absoluteCanonical)) {
    throw new Error(`Cannot write legacy alias: canonical output does not exist at ${canonicalPath}`);
  }

  copyFileSync(absoluteCanonical, absoluteLegacy);
}
