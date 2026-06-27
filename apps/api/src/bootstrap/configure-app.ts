import type { INestApplication } from '@nestjs/common';
import { AppExceptionFilter } from '../shared/app-exception.filter';
import type { RuntimeConfig } from './runtime-config';

export function configureApp(
  app: INestApplication,
  config: RuntimeConfig,
): void {
  app.useGlobalFilters(new AppExceptionFilter());

  app.enableCors({
    credentials: false,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (config.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
  });
}
