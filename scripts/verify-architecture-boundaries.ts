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

for (const file of sourceFiles('apps/worker/src')) {
  const content = read(file);
  if (content.includes('apps/api/') || content.includes('@ba-helper/api')) {
    violations.push(`${relative(file)} imports apps/api`);
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

const retiredRuntimeUseCases = [
  'packages/backend-runtime/src/scanner/application/run-scan-job.usecase.ts',
  'packages/backend-runtime/src/document/application/run-document-job.usecase.ts',
];
for (const retired of retiredRuntimeUseCases) {
  if (fs.existsSync(path.join(root, retired))) {
    violations.push(`${retired} must live in packages/application`);
  }
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

if (violations.length > 0) {
  console.error('Architecture boundary violations:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Architecture boundaries verified.');
