import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateControlledBetaReadiness } from '../tests/release/controlled-beta-readiness';

async function text(root: string, relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function json(root: string, relativePath: string): Promise<unknown> {
  return JSON.parse(await text(root, relativePath)) as unknown;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const result = evaluateControlledBetaReadiness({
    capabilityMatrix: await text(
      root,
      'docs/agent/supported-capability-matrix.md',
    ),
    operationsRunbook: await text(
      root,
      'docs/runbooks/controlled-beta-operations.md',
    ),
    authDocumentation: await text(root, 'docs/agent/auth-permissions.md'),
    architectureDecision: await text(
      root,
      'docs/adr/adr-0010-application-runtime-boundary.md',
    ),
    productionProfile: await text(root, 'docker-compose.production.yml'),
    startupDrill: await text(
      root,
      'docs/runbooks/production-startup-drill-2026-07-25.md',
    ),
    restoreDrill: await text(
      root,
      'docs/runbooks/restore-drill-2026-07-25.md',
    ),
    incidentRunbook: await text(root, 'docs/runbooks/incident-rollback.md'),
    localizationTest: await text(
      root,
      'apps/api/test/e2e/final-reviewed-report.audit-flow.e2e-spec.ts',
    ),
    publicRepositories: (await json(
      root,
      'tests/evaluation/public-nestjs-repositories.json',
    )) as { repositories: [] },
    analyzerBaseline: (await json(
      root,
      'tests/evaluation/quality-baseline.json',
    )) as { thresholds: Record<string, number> },
  });
  const outputDirectory = path.join(root, 'artifacts/release');
  const outputPath = path.join(outputDirectory, 'controlled-beta-readiness.json');

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Controlled-beta readiness: ${result.status}`);
  console.log(`Artifact: ${path.relative(root, outputPath)}`);

  if (result.status === 'FAIL') {
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  }
}

void main();

