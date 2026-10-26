import { isIsolatedPinnedTestDatabaseUrl } from './pinned-proof-environment';

describe('pinned proof database isolation', () => {
  it.each([
    'postgresql://ba_helper:ba_helper@localhost:5432/ba_helper_test',
    'postgresql://ba_helper:ba_helper@127.0.0.1:5432/ba_helper_test',
    'postgresql://ba_helper:ba_helper@[::1]:5432/ba_helper_test',
  ])('accepts the isolated local test database: %s', (databaseUrl) => {
    expect(isIsolatedPinnedTestDatabaseUrl(databaseUrl)).toBe(true);
  });

  it.each([
    'postgresql://ba_helper:secret@db.production.example:5432/ba_helper_test',
    'postgresql://ba_helper:secret@localhost:5432/production',
    'not-a-database-url',
    undefined,
  ])('rejects an unsafe proof database URL: %s', (databaseUrl) => {
    expect(isIsolatedPinnedTestDatabaseUrl(databaseUrl)).toBe(false);
  });
});
