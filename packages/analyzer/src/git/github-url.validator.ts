export class GitHubUrlValidator {
  /**
   * Validates if a URL is a secure, public GitHub repository URL.
   * Rejects local paths, SSH, credentials, private IPs, and non-github.com hosts.
   */
  static validate(urlStr: string): { isValid: boolean; error?: string } {
    if (!urlStr || typeof urlStr !== 'string') {
      return { isValid: false, error: 'URL must be a non-empty string' };
    }

    // Reject obvious SSH/Git formats early (before URL parsing)
    if (urlStr.startsWith('git@') || urlStr.startsWith('git://') || urlStr.startsWith('ssh://')) {
      return { isValid: false, error: 'Only HTTPS protocol is allowed' };
    }

    try {
      const url = new URL(urlStr);

      if (url.protocol !== 'https:') {
        return { isValid: false, error: 'Only HTTPS protocol is allowed' };
      }

      if (url.hostname !== 'github.com') {
        return { isValid: false, error: 'Only github.com host is allowed' };
      }

      if (url.username || url.password) {
        return { isValid: false, error: 'URL must not contain credentials' };
      }

      if (url.search || url.hash) {
        return { isValid: false, error: 'URL must not include query or fragment' };
      }

      // Check path format (should be /owner/repo or /owner/repo.git)
      const normalizedPath = url.pathname.replace(/\/$/, '');
      const pathParts = normalizedPath.split('/').filter(Boolean);
      if (pathParts.length !== 2) {
        return { isValid: false, error: 'URL must contain only owner and repository name' };
      }
      
      // Prevent weird characters in path
      const pathRegex = /^[\w.-]+$/;
      if (!pathRegex.test(pathParts[0]) || !pathRegex.test(pathParts[1])) {
        return { isValid: false, error: 'URL path contains invalid characters' };
      }

      return { isValid: true };
    } catch (err) {
      // If new URL() fails, it could be a local path or invalid format
      return { isValid: false, error: 'Invalid URL format' };
    }
  }
}
