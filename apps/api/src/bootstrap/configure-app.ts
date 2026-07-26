import { Logger, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppExceptionFilter } from '../shared/app-exception.filter';
import type { RuntimeConfig } from './runtime-config';

type RequestLike = {
  header(name: string): string | undefined;
  method: string;
  path: string;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
  statusCode: number;
};

export function configureApp(
  app: INestApplication,
  config: RuntimeConfig,
): void {
  const requestLogger = new Logger('HttpRequest');
  app.useGlobalFilters(new AppExceptionFilter());
  app.use((
    request: RequestLike,
    response: ResponseLike,
    next: () => void,
  ) => {
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[a-zA-Z0-9._-]{8,128}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const startedAt = Date.now();
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      requestLogger.log(
        JSON.stringify({
          event: 'HTTP_REQUEST_COMPLETED',
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  });

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
