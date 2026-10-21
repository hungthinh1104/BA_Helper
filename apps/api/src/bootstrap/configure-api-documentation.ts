import type { INestApplication } from '@nestjs/common';
import { apiReference } from '@scalar/nestjs-api-reference';
import { dirname, join } from 'node:path';
import { buildApiDocument } from './api-docs/build-api-document';

export function configureApiDocumentation(app: INestApplication, version: string): void {
  const document = buildApiDocument(app, version);
  const adapter = app.getHttpAdapter();
  // Resolve beside the installed entry, in dev and compiled Docker deployments.
  // No Vue/server-side Scalar code is imported; only the pinned standalone asset is served.
  const browserBundle = join(dirname(require.resolve('@scalar/api-reference')), 'browser', 'standalone.js');
  adapter.get('/api/openapi.json', (_req: unknown, res: { json(value: unknown): void }) => res.json(document));
  adapter.get('/api/docs/scalar.js', (_req: unknown, res: { sendFile(path: string, options: { dotfiles: 'allow' }): void }) => {
    // pnpm stores this fixed file below .pnpm; Express otherwise hides that directory.
    res.sendFile(browserBundle, { dotfiles: 'allow' });
  });
  const reference = apiReference({
    pageTitle: 'BA Helper API Reference',
    url: '/api/openapi.json',
    cdn: '/api/docs/scalar.js',
    persistAuth: false,
    proxyUrl: '',
    telemetry: false,
    withDefaultFonts: false,
    favicon: 'data:,',
    showDeveloperTools: 'never',
    agent: { disabled: true },
    hideClientButton: true,
    defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
  });
  // Exact GET routes avoid serving the docs shell for missing assets or POSTs.
  adapter.get('/api/docs', reference);
  adapter.get('/api/docs/', reference);
}
