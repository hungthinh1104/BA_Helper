import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/bootstrap/configure-app';
import { getRuntimeConfig } from '../../../src/bootstrap/runtime-config';
import * as dotenv from 'dotenv';
import * as path from 'path';

export async function createTestApp(beforeInitialize?: (moduleFixture: TestingModule) => void): Promise<INestApplication> {
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
  beforeInitialize?.(moduleFixture);

  const app = moduleFixture.createNestApplication();
  const logServerErrors = process.env.E2E_LOG_SERVER_ERRORS === 'true';
  app.useLogger(logServerErrors ? ['error'] : false);
  if (logServerErrors) {
    app.use((request: { method: string; originalUrl?: string; url: string }, response: {
      statusCode: number;
      once(event: 'finish', listener: () => void): void;
    }, next: () => void) => {
      response.once('finish', () => {
        if (response.statusCode >= 500) {
          process.stderr.write(`[E2E_HTTP_5XX] ${request.method} ${request.originalUrl ?? request.url} ${response.statusCode}\n`);
        }
      });
      next();
    });
  }
  configureApp(app, getRuntimeConfig());
  await app.init();
  return app;
}
