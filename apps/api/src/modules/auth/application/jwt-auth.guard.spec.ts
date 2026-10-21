import { JwtAuthGuard, IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const mockContext = (authorization?: string) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: authorization === undefined ? {} : { authorization } }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow if route is public', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return null;
    });

    const context = mockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows an anonymous request on an optional-auth route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === OPTIONAL_AUTH_KEY);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('runs JWT authentication when an optional-auth route receives a bearer token', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === OPTIONAL_AUTH_KEY || key === IS_PUBLIC_KEY,
    );
    const baseGuard = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate(context: ExecutionContext): boolean;
    };
    const passportCanActivate = jest.spyOn(baseGuard, 'canActivate').mockReturnValue(false);
    const context = mockContext('Bearer invalid-token');

    expect(guard.canActivate(context)).toBe(false);
    expect(passportCanActivate).toHaveBeenCalledWith(context);
    passportCanActivate.mockRestore();
  });

  describe('handleRequest', () => {
    it('should throw UnauthorizedException if error is present', () => {
      expect(() => guard.handleRequest(new Error('Some error'), null, null)).toThrow('Some error');
    });

    it('should throw UnauthorizedException if user is not present', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);
      expect(() => guard.handleRequest(null, null, null)).toThrow('Authentication required');
    });

    it('should return user if user is present and no error', () => {
      const user = { id: '1', role: 'VIEWER' };
      expect(guard.handleRequest(null, user, null)).toEqual(user);
    });
  });
});
