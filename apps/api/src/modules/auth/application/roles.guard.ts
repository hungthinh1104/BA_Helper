import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../api/roles.decorator';
import { UserRole } from '@ba-helper/contracts';
import { IS_PUBLIC_KEY } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Should not happen if JwtAuthGuard ran first, but just in case
      return false;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`User role '${user.role}' is not sufficient. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
