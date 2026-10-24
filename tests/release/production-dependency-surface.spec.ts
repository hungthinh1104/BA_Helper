import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('production dependency surface', () => {
  it('shares the same queue adapter and WorkerHost constructor across worker and runtime', () => {
    const worker = createRequire(resolve(root, 'apps/worker/package.json'));
    const runtime = createRequire(resolve(root, 'packages/backend-runtime/package.json'));
    expect(worker.resolve('@nestjs/bullmq')).toBe(runtime.resolve('@nestjs/bullmq'));
    expect(worker.resolve('bullmq')).toBe(runtime.resolve('bullmq'));
    expect(worker('@nestjs/bullmq').WorkerHost).toBe(runtime('@nestjs/bullmq').WorkerHost);
  });

  it('does not ship unused Git wrappers or the UI generator CLI', () => {
    const analyzer = JSON.parse(read('packages/analyzer/package.json'));
    const web = JSON.parse(read('apps/web/package.json'));
    expect(analyzer.dependencies['simple-git']).toBeUndefined();
    expect(web.dependencies.shadcn).toBeUndefined();
  });

  it('preserves the licensed primitive CSS when removing the generator dependency', () => {
    const css = read('apps/web/src/styles/ui-primitives.css').replace(/\r\n/g, '\n');
    const source = css.slice(css.indexOf('*/') + 2).trim();
    expect(css).toContain('Copyright (c) 2023 shadcn');
    expect(css).toContain('MIT License');
    expect(createHash('sha256').update(source).digest('hex')).toBe(
      'f02a6f0aee033060fa6b159c2676e058f9799b325cafdbdd44a796f091628747',
    );
    const imports = read('apps/web/src/app/globals.css');
    expect(imports).toContain('@import "../styles/ui-primitives.css";');
    expect(imports).not.toContain('shadcn/tailwind.css');
  });

  it('checks high and critical production advisories in CI', () => {
    const manifest = JSON.parse(read('package.json'));
    expect(manifest.scripts['verify:dependencies']).toBe('pnpm audit --prod --audit-level=high');
    expect(read('.github/workflows/ci.yml')).toContain('run: pnpm verify:dependencies');
  });

  it('isolates the CI Redis database used by test queues', () => {
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow).toContain('REDIS_URL: redis://localhost:6379/0');
    expect(workflow).toContain('REDIS_URL_TEST: redis://localhost:6379/1');
  });
});
