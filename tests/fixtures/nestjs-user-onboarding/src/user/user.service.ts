import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from './user.entity';
import { UserStatus } from './user-status.enum';
import { UserRepository } from './user.repository';
import { EmailUniquenessValidator } from '../validation/email-uniqueness.validator';
import { UserRegisteredEvent } from '../events/user-registered.handler';

export interface RegisterUserInput {
  email: string;
  displayName: string;
  passwordHash: string;
}

/**
 * Registration/onboarding business logic. Validates email uniqueness, persists
 * the new account in PENDING_VERIFICATION, and publishes the user.registered
 * event so the welcome email is delivered out of band.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailUniquenessValidator: EmailUniquenessValidator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async registerUser(input: RegisterUserInput): Promise<User> {
    await this.emailUniquenessValidator.validate(input.email);

    const user = new User();
    user.email = input.email.trim().toLowerCase();
    user.displayName = input.displayName;
    user.passwordHash = input.passwordHash;
    user.status = UserStatus.PENDING_VERIFICATION;
    user.verificationToken = `verify-${Date.now()}`;

    const saved = await this.userRepository.save(user);
    this.eventEmitter.emit('user.registered', new UserRegisteredEvent(saved));
    return saved;
  }

  async verifyEmail(token: string): Promise<User> {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new NotFoundException('Verification token is invalid or expired.');
    }
    user.status = UserStatus.ACTIVE;
    user.verificationToken = null;
    return this.userRepository.save(user);
  }
}
