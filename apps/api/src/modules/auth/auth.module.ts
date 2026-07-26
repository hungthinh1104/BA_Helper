import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './api/auth.controller';
import { JwtStrategy } from './application/jwt.strategy';
import { resolveJwtSecret } from './application/jwt-config';
import { EventLogModule, PrismaModule } from "@ba-helper/backend-runtime";
import { PasswordHashService } from './application/password-hash.service';

@Module({
  imports: [
    PrismaModule,
    EventLogModule,
    PassportModule,
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, PasswordHashService],
  exports: [JwtModule, PasswordHashService],
})
export class AuthModule {}
