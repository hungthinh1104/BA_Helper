import { AppError } from '../../../shared/app-error';

export type CanonicalRepositoryInput = {
  url: string;
  canonicalUrl: string;
};

export const RepositoryPolicy = {
  normalizeUrl: (inputUrl: string): CanonicalRepositoryInput => {
    let parsed: URL;
    try {
      parsed = new URL(inputUrl);
    } catch {
      throw new AppError('INVALID_REPOSITORY_URL', 'Repository URL is invalid.');
    }

    if (parsed.protocol !== 'https:') {
      throw new AppError(
        'INVALID_REPOSITORY_URL',
        'Repository URL must use https.',
      );
    }

    if (parsed.username || parsed.password) {
      throw new AppError(
        'INVALID_REPOSITORY_URL',
        'Repository URL must not contain credentials.',
      );
    }

    if (parsed.hostname !== 'github.com') {
      throw new AppError(
        'INVALID_REPOSITORY_URL',
        'Only github.com repositories are allowed.',
      );
    }

    if (parsed.search || parsed.hash) {
      throw new AppError(
        'INVALID_REPOSITORY_URL',
        'Repository URL must not include query or fragment.',
      );
    }

    const normalizedPath = parsed.pathname.replace(/\.git$/, '').replace(/\/$/, '');
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.length !== 2) {
      throw new AppError(
        'INVALID_REPOSITORY_URL',
        'Repository URL must include owner and repository.',
      );
    }
    const canonicalUrl = `https://github.com${normalizedPath}`;

    return { url: inputUrl, canonicalUrl };
  },

  validateCommitFreshness: (target: {
    resolvedRefType: string;
    latestObservedCommitSha: string | null;
  }, snapshotCommitSha: string): { isStale: boolean } => {
    // If it's a pinned commit, it's never stale
    if (target.resolvedRefType === 'COMMIT') {
      return { isStale: false };
    }
    
    // For branches or tags, it's stale if the latest observed commit doesn't match the snapshot's commit
    if (target.latestObservedCommitSha && target.latestObservedCommitSha !== snapshotCommitSha) {
      return { isStale: true };
    }
    
    return { isStale: false };
  },
};
