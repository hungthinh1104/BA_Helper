import { JwtAuthGuard, IS_PUBLIC_KEY } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  const mockContext = () => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
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
