import fs from 'node:fs';
import path from 'node:path';
import * as glob from 'glob';

const root = path.resolve(__dirname, '..');
const violations: string[] = [];

const sourceFiles = (directory: string) =>
  glob.sync('**/*.ts', {
    cwd: path.join(root, directory),
    absolute: true,
    ignore: ['**/*.spec.ts', '**/dist/**', '**/node_modules/**'],
  });

const read = (file: string) => fs.readFileSync(file, 'utf8');
const relative = (file: string) => path.relative(root, file);

const forbiddenApplicationImports = [
  '@nestjs/',
  '@prisma/',
  'bullmq',
  'ioredis',
  'openai',
  '@anthropic-ai/',
  '@google/generative-ai',
  '@ba-helper/backend-runtime',
];

for (const file of sourceFiles('packages/application/src')) {
  const content = read(file);
  for (const dependency of forbiddenApplicationImports) {
    if (content.includes(`'${dependency}`) || content.includes(`"${dependency}`)) {
      violations.push(
        `${relative(file)} imports forbidden application dependency ${dependency}`,
      );
    }
  }
}

// App-to-app imports are forbidden in BOTH directions.
for (const file of sourceFiles('apps/worker/src')) {
  const content = read(file);
  if (content.includes('apps/api/') || content.includes('@ba-helper/api')) {
    violations.push(`${relative(file)} imports apps/api`);
  }
}
for (const file of sourceFiles('apps/api/src')) {
  const content = read(file);
  if (content.includes('apps/worker/') || content.includes('@ba-helper/worker')) {
    violations.push(`${relative(file)} imports apps/worker`);
  }
}

for (const scope of ['apps/api', 'apps/worker', 'packages']) {
  for (const file of sourceFiles(scope)) {
    const content = read(file);
    if (
      /@ba-helper\/[^'"]+\/(?:src|dist)\//.test(content) ||
      /packages\/[^'"]+\/(?:src|dist)\//.test(content)
    ) {
      violations.push(`${relative(file)} deep-imports another package source`);
    }
  }
}

// ADR-0010: backend-runtime owns adapters + composition only. It must NOT own
// business use cases (`*.usecase.ts`) or domain policies (`domain/*.policy.ts`).
// The former migration-debt allowlist is now empty — every such file lives in
// packages/application — so the rule is unconditional and catches any new offender.
for (const file of sourceFiles('packages/backend-runtime/src')) {
  const rel = relative(file);
  const isUseCase = /\.usecase\.ts$/.test(file);
  const isDomainPolicy = /\/domain\/[^/]+\.policy\.ts$/.test(file);
  if (isUseCase || isDomainPolicy) {
    violations.push(
      `${rel} is a business use case or domain policy and must live in packages/application (ADR-0010)`,
    );
  }
}

// Circular dependency detection over the internal workspace package graph.
const cycleViolation = detectWorkspaceDependencyCycle();
if (cycleViolation) {
  violations.push(cycleViolation);
}

const allowedWorkspaceDependencies: Record<string, Set<string>> = {
  '@ba-helper/application': new Set([
    '@ba-helper/analyzer',
    '@ba-helper/contracts',
    '@ba-helper/shared',
  ]),
  '@ba-helper/backend-runtime': new Set([
    '@ba-helper/analyzer',
    '@ba-helper/application',
    '@ba-helper/contracts',
    '@ba-helper/shared',
  ]),
};

for (const packageDir of ['packages/application', 'packages/backend-runtime']) {
  const manifestPath = path.join(root, packageDir, 'package.json');
  const manifest = JSON.parse(read(manifestPath)) as {
    name: string;
    dependencies?: Record<string, string>;
  };
  const allowed = allowedWorkspaceDependencies[manifest.name];
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (dependency.startsWith('@ba-helper/') && !allowed.has(dependency)) {
      violations.push(`${manifest.name} has forbidden dependency ${dependency}`);
    }
  }
}

function detectWorkspaceDependencyCycle(): string | null {
  const packageDirs = glob.sync('packages/*/package.json', {
    cwd: root,
    absolute: true,
  });
  const graph = new Map<string, string[]>();
  for (const manifestPath of packageDirs) {
    const manifest = JSON.parse(read(manifestPath)) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (!manifest.name?.startsWith('@ba-helper/')) continue;
    const deps = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    }).filter((dep) => dep.startsWith('@ba-helper/'));
    graph.set(manifest.name, deps);
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const walk = (node: string): string[] | null => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      if (state.get(next) === 'visiting') {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (state.get(next) !== 'done') {
        const cycle = walk(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };

  for (const node of graph.keys()) {
    if (state.get(node) !== 'done') {
      const cycle = walk(node);
      if (cycle) {
        return `circular workspace dependency: ${cycle.join(' -> ')}`;
      }
    }
  }
  return null;
}

if (violations.length > 0) {
  console.error('Architecture boundary violations:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Architecture boundaries verified.');
