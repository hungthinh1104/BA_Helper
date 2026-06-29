import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { AppExceptionFilter } from '../../../src/shared/app-exception.filter';
import * as dotenv from 'dotenv';
import * as path from 'path';

export async function createTestApp(): Promise<INestApplication> {
  // Load .env.test explicitly
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

  // 1. Enforce Test DB and Providers
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: 'test' });
  process.env.AI_PROVIDER = 'fake';
  process.env.EMBEDDING_PROVIDER = 'fake';
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useLogger(false);
  app.useGlobalFilters(new AppExceptionFilter());
  await app.init();
  return app;
}
