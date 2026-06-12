import { SecretRedactor } from '../../../src/scanner/core/secret-redactor';

describe('SecretRedactor', () => {
  it('redacts AWS access key', () => {
    const raw = 'const key = "AKIAIOSFODNN7EXAMPLE";';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(true);
    expect(result.redactedContent).toBe('const key = "[REDACTED_SECRET:AWS_ACCESS_KEY]";');
  });

  it('redacts GitHub token', () => {
    const raw = 'const token = "ghp_16C7e42F292c6912E7710c838347Ae178B4a";';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(true);
    expect(result.redactedContent).toBe('const token = "[REDACTED_SECRET:GITHUB_TOKEN]";');
  });

  it('redacts database URL credentials', () => {
    const raw = 'const db = "postgres://admin:secret123@localhost:5432/mydb";';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(true);
    expect(result.redactedContent).toBe('const db = "postgres://[REDACTED_SECRET:CREDENTIALS]@localhost:5432/mydb";');
  });

  it('redacts JWT-like token', () => {
    const raw = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZS.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(true);
    expect(result.redactedContent).toContain('[REDACTED_SECRET:JWT]');
    expect(result.redactedContent).not.toContain('eyJhbGciOi');
  });

  it('redacts .env assignment', () => {
    const raw = 'const API_SECRET = "super_secret_value_that_is_long_enough";';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(true);
    expect(result.redactedContent).toBe('const API_SECRET = "[REDACTED_SECRET:ENV_SECRET]";');
  });

  it('does not redact normal code identifiers', () => {
    const raw = 'const myVar = "short_string";\nconst API_SECRET = "short";';
    const result = SecretRedactor.redact(raw);
    expect(result.foundSecrets).toBe(false);
    expect(result.redactedContent).toBe(raw);
  });
});
