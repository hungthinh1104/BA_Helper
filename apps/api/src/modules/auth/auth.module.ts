import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './api/auth.controller';
import { JwtStrategy } from './application/jwt.strategy';
import { resolveJwtSecret } from './application/jwt-config';
import { PrismaModule } from "@ba-helper/backend-runtime";

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
