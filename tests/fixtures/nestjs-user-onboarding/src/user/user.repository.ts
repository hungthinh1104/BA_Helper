import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/**
 * Persistence gateway for user accounts. Wraps the TypeORM repository so the
 * registration flow can save new users and look them up by email.
 */
@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.repo.findOne({ where: { verificationToken: token } });
  }
}
