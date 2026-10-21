import { applyDecorators, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const IS_PUBLIC_KEY = 'isPublic';
export const OPTIONAL_AUTH_KEY = 'optionalAuth';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const OptionalAuth = () => applyDecorators(Public(), SetMetadata(OPTIONAL_AUTH_KEY, true));

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const targets = [
      context.getHandler(),
      context.getClass(),
    ];
    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets);
    if (optionalAuth) {
      const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string | string[] } }>();
      if (request.headers?.authorization === undefined) return true;
      return super.canActivate(context);
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
