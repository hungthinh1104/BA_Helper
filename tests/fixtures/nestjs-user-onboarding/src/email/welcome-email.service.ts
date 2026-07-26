import { Injectable, Logger } from '@nestjs/common';
import { User } from '../user/user.entity';

/**
 * External integration that sends the onboarding welcome email through the email
 * provider. In production this calls an outbound email gateway; here it is a
 * deterministic stand-in for the analyzer fixture.
 */
@Injectable()
export class WelcomeEmailService {
  private readonly logger = new Logger(WelcomeEmailService.name);

  async sendWelcomeEmail(user: User): Promise<void> {
    const verificationLink = `https://app.example.com/verify?token=${user.verificationToken}`;
    this.logger.log(`Sending welcome email to ${user.email} with verification link ${verificationLink}`);
    // Outbound call to the email provider would happen here.
  }
}
