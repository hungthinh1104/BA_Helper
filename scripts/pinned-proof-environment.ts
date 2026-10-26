const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isIsolatedPinnedTestDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    const parsed = new URL(databaseUrl);
    const databasePath = decodeURIComponent(parsed.pathname.replace(/\/+$/, ''));
    return databasePath === '/ba_helper_test' && LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
