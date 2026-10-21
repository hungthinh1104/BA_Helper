import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@ba-helper/backend-runtime';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let findUnique: jest.Mock;

  beforeEach(() => {
    findUnique = jest.fn();
    strategy = new JwtStrategy({ user: { findUnique } } as unknown as PrismaService);
  });

  it.each([null, {}, { sub: 'not-a-uuid' }, { sub: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', credentialsVersion: '1' },
    { sub: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', credentialsVersion: 2_147_483_648 }])(
    'rejects malformed signed claims before querying persistence: %j', async payload => {
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('loads only current session fields and uses the persisted role', async () => {
    findUnique.mockResolvedValue({
      id: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', email: 'user@example.com', name: null,
      role: 'ADMIN', disabledAt: null, credentialsVersion: 1,
    });
    await expect(strategy.validate({
      sub: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', credentialsVersion: 1, role: 'VIEWER',
    })).resolves.toEqual({
      id: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', email: 'user@example.com', role: 'ADMIN',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111' },
      select: { id: true, email: true, name: true, role: true, disabledAt: true, credentialsVersion: true },
    });
  });

  it('preserves legacy tokens without a credentials version and rejects revoked sessions', async () => {
    findUnique.mockResolvedValue({
      id: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', email: 'user@example.com', name: 'User',
      role: 'REVIEWER', disabledAt: null, credentialsVersion: 1,
    });
    await expect(strategy.validate({ sub: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111' })).resolves.toMatchObject({ role: 'REVIEWER' });
    findUnique.mockResolvedValueOnce({
      id: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', email: 'user@example.com', name: null,
      role: 'REVIEWER', disabledAt: null, credentialsVersion: 2,
    });
    await expect(strategy.validate({ sub: 'a881d202-2415-4bca-aeb8-a4c8c3bc1111', credentialsVersion: 1 }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
