import { PasswordHashService } from './password-hash.service';

describe('PasswordHashService', () => {
  const service = new PasswordHashService();

  it('hashes passwords with self-describing scrypt parameters', async () => {
    const hash = await service.hashPassword('correct-password-123');

    expect(hash).toMatch(/^scrypt\$v=1\$N=131072\$r=8\$p=1\$keylen=64\$/);
    expect(hash).not.toContain('correct-password-123');
  });

  it('verifies matching passwords and rejects non-matching passwords', async () => {
    const hash = await service.hashPassword('correct-password-123');

    await expect(service.verifyPassword(hash, 'correct-password-123')).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'wrong-password-123')).resolves.toBe(false);
  });

  it('rejects unsupported hash formats', async () => {
    await expect(
      service.verifyPassword('argon2id$unsupported', 'correct-password-123'),
    ).resolves.toBe(false);
  });
});
