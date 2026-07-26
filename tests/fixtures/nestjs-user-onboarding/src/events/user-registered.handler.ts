import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WelcomeEmailService } from '../email/welcome-email.service';
import { User } from '../user/user.entity';

export class UserRegisteredEvent {
  constructor(public readonly user: User) {}
}

/**
 * Event handler that reacts to a completed registration by dispatching the
 * welcome email. Decouples the registration transaction from the outbound
 * notification side effect.
 */
@Injectable()
export class UserRegisteredHandler {
  private readonly logger = new Logger(UserRegisteredHandler.name);

  constructor(private readonly welcomeEmailService: WelcomeEmailService) {}

  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(`Handling user.registered event for ${event.user.email}`);
    await this.welcomeEmailService.sendWelcomeEmail(event.user);
  }
}
