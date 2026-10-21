import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RequestUser } from '@ba-helper/contracts';
import { z } from 'zod';
import { resolveJwtSecret } from './jwt-config';
import { PrismaService } from "@ba-helper/backend-runtime";

const jwtSessionClaimsSchema = z.object({
  sub: z.string().uuid(),
  credentialsVersion: z.number().int().min(1).max(2_147_483_647).optional(),
});

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(),
    });
  }

  async validate(payload: unknown): Promise<RequestUser> {
    const parsed = jwtSessionClaimsSchema.safeParse(payload);
    if (!parsed.success) throw new UnauthorizedException('Invalid access token.');

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.data.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabledAt: true,
        credentialsVersion: true,
      },
    });

    if (
      !user ||
      user.disabledAt ||
      (parsed.data.credentialsVersion ?? 1) !== user.credentialsVersion
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role as RequestUser['role'],
    };
  }
}
