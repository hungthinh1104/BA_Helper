import { Injectable, ConflictException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';

/**
 * Domain validator that enforces email uniqueness during registration. Rejects a
 * registration when an account already exists for the given email address.
 */
@Injectable()
export class EmailUniquenessValidator {
  constructor(private readonly userRepository: UserRepository) {}

  async validate(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.userRepository.findByEmail(normalized);
    if (existing) {
      throw new ConflictException(`Email ${normalized} is already registered.`);
    }
  }
}
