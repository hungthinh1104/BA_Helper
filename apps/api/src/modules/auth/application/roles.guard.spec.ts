import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './jwt-auth.guard';
import { ROLES_KEY } from '../api/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const mockContext = (user?: any) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
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

  it('should allow if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return undefined;
      return null;
    });

    const context = mockContext({ role: 'VIEWER' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny (return false) if no user is present but roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN'];
      return null;
    });

    const context = mockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should throw ForbiddenException if user lacks required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN', 'REVIEWER'];
      return null;
    });

    const context = mockContext({ role: 'VIEWER' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow("User role 'VIEWER' is not sufficient. Required roles: ADMIN, REVIEWER");
  });

  it('should allow if user has required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return ['ADMIN', 'REVIEWER'];
      return null;
    });

    const context = mockContext({ role: 'REVIEWER' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
