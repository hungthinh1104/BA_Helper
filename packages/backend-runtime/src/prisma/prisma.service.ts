import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { requireEnv } from '@ba-helper/shared';

const DATABASE_CONNECTION_TIMEOUT_MS = 10_000;

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: requireEnv('DATABASE_URL', 'postgresql://localhost/ba_helper'),
      connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    const client = await this.pool.connect();
    client.release();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
