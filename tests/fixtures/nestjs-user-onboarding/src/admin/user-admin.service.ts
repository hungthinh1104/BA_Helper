import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';

/**
 * Administrative user management. These operations (account deletion, bulk
 * export) are unrelated to the onboarding/registration flow and must never be
 * committed as an impact of an onboarding change request — explicit negatives.
 */
@Injectable()
export class UserAdminService {
  private readonly logger = new Logger(UserAdminService.name);

  constructor(private readonly userRepository: UserRepository) {}

  async deleteUser(userId: string): Promise<void> {
    this.logger.warn(`Administratively deleting user ${userId}`);
    // Hard delete performed by an admin, not part of onboarding.
  }

  async exportUsers(): Promise<string> {
    this.logger.warn('Exporting the full user directory for compliance.');
    return 'user-export.csv';
  }
}
