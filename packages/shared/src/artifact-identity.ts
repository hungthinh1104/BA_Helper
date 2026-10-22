/** Builds a stable artifact key from its kind, canonical repository path, and qualified symbol. */
export function createArtifactIdentity(kind: string, filePath: string, qualifiedSymbol: string): string {
  const path = canonicalRepositoryPath(filePath);
  return `${kind}:${encodeURIComponent(path)}#${encodeURIComponent(qualifiedSymbol)}`;
}

function canonicalRepositoryPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) {
    throw new TypeError('Artifact identity requires a repository-relative file path.');
  }

  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) throw new TypeError('Artifact identity path cannot escape the repository root.');
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  if (segments.length === 0) throw new TypeError('Artifact identity requires a repository-relative file path.');
  return segments.join('/');
}
