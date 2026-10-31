import type { ChangeArea, ChangedPath } from './types';

export interface ChangeClassification {
  areas: Set<ChangeArea>;
  fullReasons: string[];
  executablePaths: string[];
  documentationOnly: boolean;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.prisma', '.css', '.scss', '.py', '.java', '.go', '.rb', '.cs', '.php', '.rs', '.sh', '.ps1']);

export function classifyChanges(changes: ChangedPath[]): ChangeClassification {
  const areas = new Set<ChangeArea>();
  const fullReasons: string[] = [];
  const executablePaths: string[] = [];

  for (const change of changes) {
    const file = change.path.toLowerCase().replace(/\\/g, '/');
    const extension = file.slice(file.lastIndexOf('.'));
    const isSource = SOURCE_EXTENSIONS.has(extension);
    if (isSource) executablePaths.push(change.path);
    if (change.kind === 'deleted' && isTestFile(file)) {
      areas.add('full');
      fullReasons.push(`${change.path}: deleting a test requires FULL verification and review.`);
      continue;
    }

    const reason = fullScopeReason(file, extension);
    if (reason) {
      areas.add('full');
      fullReasons.push(`${change.path}: ${reason}`);
      continue;
    }
    let recognized = false;
    if (file.startsWith('apps/api/prisma/')) { areas.add('prisma'); recognized = true; }
    if (file.startsWith('packages/contracts/')) { areas.add('contracts'); recognized = true; }
    if (/(embedding|retrieval|vector)/.test(file)) { areas.add('embedding'); recognized = true; }
    if (file.startsWith('apps/worker/') || /(queue|worker)/.test(file)) { areas.add('worker'); recognized = true; }
    if (file.startsWith('packages/analyzer/') || file.startsWith('tests/analyzer/') || /(scanner|test-trace|static-test-graph)/.test(file)) { areas.add('analyzer'); recognized = true; }
    if (file.startsWith('tests/evaluation/')) { areas.add('analyzer'); recognized = true; }
    if (file.startsWith('apps/web/src/') || file.startsWith('e2e/')) { areas.add('frontend'); recognized = true; }
    if (file.startsWith('apps/api/test/e2e/')) { areas.add('api-e2e'); recognized = true; }
    if (isTestFile(file)) { areas.add('tests'); recognized = true; }
    if (file.startsWith('apps/api/src/') || file.startsWith('packages/backend-runtime/') || file.startsWith('packages/application/') || file.startsWith('packages/shared/')) { areas.add('backend'); recognized = true; }
    if (extension === '.md') { areas.add('docs'); recognized = true; }

    if (isSource && !recognized) {
      areas.add('full');
      fullReasons.push(`${change.path}: executable path has no declared subsystem mapping`);
    }
  }
  return { areas, fullReasons, executablePaths, documentationOnly: executablePaths.length === 0 && areas.has('docs') };
}

function fullScopeReason(file: string, extension: string): string | undefined {
  if (file === '.github/workflows/ci.yml' || file.startsWith('.github/workflows/')) return 'CI workflow changes require FULL';
  if (file === 'package.json' || file === 'pnpm-lock.yaml' || file.endsWith('/package.json')) return 'dependency or package-script changes require FULL';
  if (file.startsWith('scripts/')) return 'verification scripts require FULL';
  if (file.startsWith('.agents/skills/verify-change/')) return 'verification skill changes require FULL';
  if (['jest.config.ts', 'jest.ci.config.ts', 'jest.unit.config.ts', 'jest.integration.config.ts', 'jest.analyzer.config.ts', 'jest.e2e.config.ts', 'jest.shared.config.cjs', 'jest.transforms.cjs', 'playwright.config.ts'].includes(file)) return 'test-runner configuration changes require FULL';
  if (file === 'agents.md' || file === 'docs/agent/testing-strategy.md' || file === 'docs/agent/done-checklist.md') return 'verification instructions require FULL';
  if (extension === '.json' && !file.startsWith('tests/fixtures/')) return 'executable/configuration JSON changes require FULL';
  if (extension === '.yml' || extension === '.yaml' || extension === '.ps1' || extension === '.sh') return 'build or automation configuration changes require FULL';
  return undefined;
}

function isTestFile(file: string): boolean {
  return /\.(?:spec|test|fixture-spec|e2e-spec|pw)\.[cm]?[jt]sx?$/.test(file);
}
