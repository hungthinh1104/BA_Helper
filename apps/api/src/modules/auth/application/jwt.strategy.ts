import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RequestUser } from '@ba-helper/contracts';
import { resolveJwtSecret } from './jwt-config';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    name?: string;
    credentialsVersion?: number;
  }): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (
      !user ||
      user.disabledAt ||
      (payload.credentialsVersion ?? 1) !== user.credentialsVersion
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role as any,
    };
  }
}
