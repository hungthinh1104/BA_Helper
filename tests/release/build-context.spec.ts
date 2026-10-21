import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Docker build context', () => {
  it('excludes local tools, runtime evidence and environment files from build inputs', () => {
    const rules = readFileSync(resolve('.dockerignore'), 'utf8').split(/\r?\n/).map(line => line.trim());
    for (const rule of ['**/tmp', '**/temp', 'artifacts', 'e2e/.artifacts', '**/*.log', '**/*.tsbuildinfo', '**/.env', '**/.env.*']) {
      expect(rules).toContain(rule);
    }
  });
});

describe('Web startup', () => {
  it('uses token typography without fetching unused Google fonts during compilation', () => {
    const layout = readFileSync(resolve('apps/web/src/app/layout.tsx'), 'utf8');
    expect(layout).not.toContain('next/font/google');
    const tokens = readFileSync(resolve('apps/web/src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain('--font-sans:');
    expect(tokens).toContain('system-ui');
  });
});
