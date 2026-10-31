import { AiPolicy } from './ai.policy';

describe('AiPolicy.redactPayload', () => {
  it('redacts credentials, provider tokens, JWTs, database URLs, and private keys', () => {
    const payload = [
      'apiKey="sk-proj-local-demo-key-0123456789abcdefghijklmnop"',
      '{"accessToken": "local-access-token-demo-value"}',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsb2NhbC1kZW1vIn0.local-signature',
      'DATABASE_URL=postgresql://analyst:local-db-password@db.test:5432/app',
      'GOOGLE_API_KEY=AIzaLocalDemoKey0123456789abcdefgh',
      'github_pat_localDemoToken012345678901234567890123',
      '-----BEGIN PRIVATE KEY-----\nTUFSS0VEX1RFU1RfS0VZ\n-----END PRIVATE KEY-----',
    ].join('\n');

    const result = AiPolicy.redactPayload(payload);

    expect(result.hasSecrets).toBe(true);
    for (const secret of [
      'sk-proj-local-demo-key-0123456789abcdefghijklmnop',
      'local-access-token-demo-value',
      'eyJhbGciOiJIUzI1NiJ9',
      'local-db-password',
      'AIzaLocalDemoKey0123456789abcdefgh',
      'github_pat_localDemoToken012345678901234567890123',
      'TUFSS0VEX1RFU1RfS0VZ',
    ]) {
      expect(result.redactedPayload.includes(secret)).toBe(false);
    }
    expect(result.redactedPayload).toContain('[REDACTED');
  });

  it('leaves ordinary prose and code identifiers intact', () => {
    const payload = 'const tokenCount = 3; The payment status is pending.';

    expect(AiPolicy.redactPayload(payload)).toEqual({
      redactedPayload: payload,
      hasSecrets: false,
    });
  });
});
