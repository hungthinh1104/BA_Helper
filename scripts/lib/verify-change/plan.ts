import path from 'node:path';
import type { ChangeClassification } from './classification';
import type { ChangeArea, ChangedPath, CommandSpec, RelatedTestSelection, VerificationLevel } from './types';
import { relatedSelections } from './selection';

const JEST_CLI = 'node_modules/jest/bin/jest.js';

export function createCommands(
  root: string,
  level: VerificationLevel,
  classification: ChangeClassification,
  changes: ChangedPath[],
  evidenceDirectory: string,
): CommandSpec[] {
  if (level === 'full' || (level === 'affected' && classification.areas.has('full'))) return createFullCommands(root, evidenceDirectory);
  return createAffectedCommands(root, level, classification, changes, evidenceDirectory);
}

export function createFullCommands(root: string, evidenceDirectory: string): CommandSpec[] {
  const commands: CommandSpec[] = [];
  const add = (id: string, args: string[], reason: string, requires?: CommandSpec['requires']) => commands.push(pnpm(id, args, reason, requires));
  commands.push({ id: 'diff-check', executable: 'git', args: ['diff', '--check', 'HEAD'], reason: 'Reject whitespace errors in the candidate diff.' });
  add('dependency-audit', ['verify:dependencies'], 'Production dependency vulnerability gate.');
  add('prisma-validate', ['--dir', 'apps/api', 'exec', 'prisma', 'validate', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'], 'Validate the candidate schema.', ['test-targets']);
  add('prisma-generate', ['--dir', 'apps/api', 'exec', 'prisma', 'generate', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'], 'Generate the client from the candidate schema.', ['test-targets']);
  add('migrate-test-target', ['--dir', 'apps/api', 'exec', 'prisma', 'migrate', 'deploy', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'], 'Apply migrations only to the validated test database.', ['test-targets']);
  add('early-seed-check', ['--dir', 'apps/api', 'seed:demo'], 'Surface seed transform/configuration defects immediately after migrations.', ['test-targets']);
  add('migration-upgrade', ['verify:migration-upgrade'], 'Verify migration upgrade and historical data survival.', ['test-targets', 'migration-target']);
  add('domain-packs', ['verify:domain-packs'], 'Verify governed domain-pack inputs.');
  commands.push(jest(root, 'scan-source-omission-analyzer', 'jest.analyzer.config.ts', ['packages/analyzer/tests/scanner/core/safe-file-enumerator.spec.ts'], evidenceDirectory, false, 'CI source omission regression.'));
  commands.push(jest(root, 'scan-source-omission-runtime', 'jest.unit.config.ts', ['packages/backend-runtime/src/scanner/application/scan-health-diagnostics.spec.ts'], evidenceDirectory, true, 'CI source omission regression.'));
  commands.push(jest(root, 'runtime-config-isolation', 'jest.ci.config.ts', ['apps/api/src/bootstrap/runtime-config.spec.ts'], evidenceDirectory, true, 'CI runtime configuration isolation regression.'));
  add('analyzer-quality', ['verify:analyzer-quality'], 'Run analyzer quality scorecard.');
  add('public-test-trace', ['verify:public-test-trace'], 'Run public NestJS trace corpus.');
  add('adversarial-evidence', ['verify:adversarial-evidence'], 'Run adversarial source/evidence validation.');
  add('application-test-trace', ['verify:application-test-trace'], 'Run application test trace evaluation.');
  add('test-trace-benchmark', ['benchmark:static-test-graph', '--', 'ci'], 'Run CI-size graph benchmark.');
  add('http-boundaries', ['verify:backend-runtime-http-boundary'], 'Verify HTTP/runtime boundaries.');
  add('architecture-boundaries', ['verify:architecture-boundaries'], 'Verify module and persistence boundaries.');
  add('backend-runtime-boundary', ['verify:backend-runtime-boundary'], 'Verify worker/runtime boundaries.');
  add('release-drill', ['verify:release-drill'], 'Build and exercise the isolated production profile.', ['docker']);
  const readiness = pnpm('controlled-beta-readiness', ['verify:controlled-beta-readiness'], 'Evaluate readiness against this run’s release evidence.', ['docker']);
  readiness.dependsOn = ['release-drill'];
  commands.push(readiness);
  add('typecheck', ['typecheck'], 'Typecheck backend, scripts, and web consumers.');
  add('lint', ['lint'], 'Lint all workspaces.');
  add('web-build', ['--filter', 'web...', 'build'], 'Build the production web app.');
  for (const workspace of ['@ba-helper/application', '@ba-helper/analyzer', '@ba-helper/backend-runtime', '@ba-helper/api', '@ba-helper/worker']) {
    add(`build-${workspace.replace('@ba-helper/', '')}`, ['--filter', workspace, 'build'], `Build ${workspace}.`);
  }
  commands.push(jest(root, 'analyzer-tests', 'jest.analyzer.config.ts', [], evidenceDirectory, false, 'Run the analyzer suite including fixture suites omitted by root Jest.', root, undefined, 2));
  commands.push(jest(root, 'root-tests', 'jest.config.ts', [], evidenceDirectory, true, 'Run the local backend/root Jest suite serially. Includes the CI app suite plus local-only tests.', root, ['test-targets']));
  commands.push(jest(root, 'web-tests', 'jest.config.ts', [], evidenceDirectory, true, 'Run all web unit tests serially.', path.join(root, 'apps/web')));
  commands.push(e2eCommand('api-e2e', [], 'Run serial API E2E against the validated PostgreSQL/Redis targets.', evidenceDirectory));
  commands.push(jest(root, 'golden-path', 'jest.config.ts', ['tests/demo/golden-path-demo.spec.ts'], evidenceDirectory, true, 'Run the explicit golden path with isolated test services.', root, ['test-targets']));
  commands.push(jest(root, 'multi-repo-golden-path', 'jest.config.ts', ['tests/demo/multi-repo-golden-path-demo.spec.ts'], evidenceDirectory, true, 'Run the explicit multi-repository golden path.', root, ['test-targets']));
  commands.push({
    id: 'browser-journeys', executable: 'playwright',
    args: ['test', '--config=playwright.config.ts'],
    reason: 'Run all configured Chromium desktop/mobile journeys with one worker.',
    requires: ['test-targets', 'browser'], reportPath: path.join(evidenceDirectory, 'browser-journeys.json'),
    env: { VERIFY_CHANGE_PLAYWRIGHT_REPORT: path.join(evidenceDirectory, 'browser-journeys.json') },
  });
  add('final-demo-seed', ['--dir', 'apps/api', 'seed:demo'], 'Restore demo identity after tests reset the test database, before pinned proofs.', ['test-targets']);
  add('pinned-comprehension', ['prove:pinned-comprehension'], 'Verify the immutable pinned repository proof.', ['test-targets', 'pinned-corpus']);
  add('pinned-comprehension-browser', ['verify:pinned-comprehension-browser'], 'Verify the pinned proof through the browser journey.', ['test-targets', 'pinned-corpus', 'browser']);
  return commands;
}

function createAffectedCommands(root: string, level: VerificationLevel, classification: ChangeClassification, changes: ChangedPath[], evidenceDirectory: string): CommandSpec[] {
  const areas = classification.areas;
  const commands: CommandSpec[] = [{ id: 'diff-check', executable: 'git', args: ['diff', '--check', 'HEAD'], reason: 'Reject whitespace errors in the candidate diff.' }];
  if (classification.documentationOnly) return commands;
  const selections = relatedSelections(root, classification, changes);
  if (level === 'focused') {
    for (const selection of selections) commands.push(related(selection));
    if (areas.has('api-e2e')) commands.push(pnpm('api-e2e', ['test:e2e'], 'Focused changes to API E2E fixtures run serially.', ['test-targets']));
    if (areas.has('frontend')) commands.push(...frontendCommands(root, changes, evidenceDirectory, true));
    return commands;
  }

  for (const selection of selections) commands.push(related(selection));
  if (classification.executablePaths.length > 0) {
    commands.push(pnpm('typecheck', ['typecheck'], 'Typecheck changed workspace consumers.'));
    commands.push(pnpm('lint', ['lint'], 'Lint changed workspace sources.'));
  }
  if (areas.has('contracts')) {
    commands.push(jest(root, 'contract-backend-suite', 'jest.config.ts', [], evidenceDirectory, true, 'Contracts require backend suite and shared schema coverage.', root, ['test-targets']));
    commands.push(jest(root, 'contract-web-suite', 'jest.config.ts', [], evidenceDirectory, true, 'Contracts require web consumer coverage.', path.join(root, 'apps/web')));
    commands.push(e2eCommand('contract-api-e2e', [], 'Contracts require serial API E2E consumers.', evidenceDirectory));
  }
  if (areas.has('prisma')) {
    commands.push(pnpm('prisma-validate', ['--dir', 'apps/api', 'exec', 'prisma', 'validate', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'], 'Validate Prisma schema.', ['test-targets']));
    commands.push(pnpm('prisma-generate', ['--dir', 'apps/api', 'exec', 'prisma', 'generate', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'], 'Generate Prisma client.', ['test-targets']));
    commands.push(pnpm('migration-upgrade', ['verify:migration-upgrade'], 'Verify migration upgrade/data survival.', ['test-targets', 'migration-target']));
    commands.push(e2eCommand('prisma-api-e2e', [], 'Prisma changes require full serial PostgreSQL API E2E.', evidenceDirectory));
  }
  if (areas.has('embedding')) {
    commands.push(jest(root, 'embedding-retrieval-evals', 'jest.config.ts', [
      'tests/evaluation/hybrid-retrieval.smoke.spec.ts',
      'tests/evaluation/semantic-test-behavior.spec.ts',
    ], evidenceDirectory, true, 'Validate retrieval identity, semantics, and evaluation fixtures.'));
    commands.push(jest(root, 'embedding-analyzer-fixture', 'jest.analyzer.config.ts', ['tests/analyzer/retrieval.fixture-spec.ts'], evidenceDirectory, true, 'Run retrieval fixture coverage with its native analyzer config.'));
    commands.push(e2eCommand('embedding-isolation-e2e', ['--runTestsByPath',
      'apps/api/test/e2e/embedding-model-identity.e2e-spec.ts',
      'apps/api/test/e2e/embedding-chunk-provenance.e2e-spec.ts',
      'apps/api/test/e2e/retrieval-provider-redaction.e2e-spec.ts',
      'apps/api/test/e2e/evidence-artifact-snapshot-scope.e2e-spec.ts'],
    'Run model/provenance/scope/redaction isolation E2E.', evidenceDirectory));
  }
  if (areas.has('worker')) {
    commands.push(e2eCommand('worker-recovery-e2e', ['--runTestsByPath',
      'apps/api/test/e2e/worker-process-recovery.e2e-spec.ts',
      'apps/api/test/e2e/document-job-startup-recovery.e2e-spec.ts',
      'apps/api/test/e2e/scan-job-enqueue-recovery.e2e-spec.ts',
      'apps/api/test/e2e/impact-analysis-enqueue-recovery.e2e-spec.ts',
      'apps/api/test/e2e/redis-outage-recovery.e2e-spec.ts',
      'apps/api/test/e2e/queue-test-prefix-cleanup.e2e-spec.ts'],
    'Run enqueue, retry, termination, stale-job and Redis-outage recovery suites serially.', evidenceDirectory));
  }
  if (areas.has('analyzer')) commands.push(...analyzerCommands(root, evidenceDirectory));
  if (areas.has('api-e2e') && !areas.has('contracts') && !areas.has('prisma') && !areas.has('embedding') && !areas.has('worker')) {
    commands.push(e2eCommand('api-e2e', [], 'API E2E changes run the serial E2E suite.', evidenceDirectory));
  }
  if (areas.has('frontend')) commands.push(...frontendCommands(root, changes, evidenceDirectory, false));
  return commands;
}

function analyzerCommands(root: string, output: string): CommandSpec[] {
  const commands = [jest(root, 'analyzer-suite', 'jest.analyzer.config.ts', [], output, false, 'Run all analyzer tests, including six fixture suites outside root Jest.', root, undefined, 2)];
  for (const gate of ['verify:analyzer-quality', 'verify:public-test-trace', 'verify:adversarial-evidence', 'verify:application-test-trace']) {
    commands.push(pnpm(gate, [gate], `Required analyzer gate: ${gate}.`));
  }
  commands.push(pnpm('analyzer-graph-benchmark', ['benchmark:static-test-graph', '--', 'ci'], 'Run the static test graph benchmark.'));
  commands.push(jest(root, 'analyzer-scanner-persistence', 'jest.config.ts', ['packages/backend-runtime/src/scanner/application/run-scan-job-persistence.step.spec.ts'], output, true, 'Verify scanner persistence consumers.'));
  commands.push(jest(root, 'analyzer-qa-consumer', 'jest.analyzer.config.ts', ['tests/analyzer/qa-test-trace.fixture-spec.ts'], output, true, 'Verify QA trace fixture consumers.'));
  return commands;
}

function frontendCommands(root: string, changes: ChangedPath[], output: string, focused: boolean): CommandSpec[] {
  const paths = new Set<string>();
  const groups = new Set<string>();
  for (const change of changes) {
    const file = change.path.toLowerCase();
    if (file.includes('code-evidence') || file.includes('comprehension') || file.includes('trace')) { paths.add('e2e/code-comprehension-trace.pw.ts'); groups.add('comprehension'); }
    if (file.includes('review') || file.includes('report') || file.includes('evidence') || file.includes('impact')) { paths.add('e2e/decision-to-report.pw.ts'); groups.add('review/report'); }
    if (file.includes('multi-repo') || file.includes('repository')) { paths.add('e2e/multi-repo-review.pw.ts'); groups.add('multi-repository'); }
    if (file.includes('auth')) { paths.add('e2e/auth-headers.pw.ts'); groups.add('auth'); }
    if (file.includes('api')) { paths.add('e2e/api-documentation.pw.ts'); groups.add('API documentation'); }
    if (file.includes('navigation') || file.includes('responsive') || file.includes('layout')) {
      paths.add('e2e/responsive-sweep.pw.ts'); paths.add('e2e/route-smoke.pw.ts'); groups.add('responsive/navigation');
    }
  }
  const unknown = paths.size === 0 && changes.some((change) => change.path.startsWith('apps/web/src/'));
  const all = unknown || (!focused && changes.some((change) => /apps\/web\/src\/.*(?:navigation|layout|global)/i.test(change.path)));
  const args = ['test', '--config=playwright.config.ts'];
  if (!all) for (const file of [...paths].sort()) args.push(file);
  void focused;
  return [{
    id: 'browser-journeys', executable: 'playwright', args,
    reason: all ? 'No specific UI journey mapping exists; run the complete serial browser suite.' : `Mapped browser groups: ${[...groups].sort().join(', ') || 'explicit UI test paths'}.`,
    requires: ['test-targets', 'browser'], reportPath: path.join(output, 'browser-journeys.json'),
  }];
}

function related(selection: RelatedTestSelection): CommandSpec {
  return {
    id: selection.id, executable: 'node', args: [], cwd: selection.cwd,
    reason: selection.reason, selection,
  };
}

function jest(root: string, id: string, config: string, files: string[], output: string, serial: boolean, reason: string, cwd = root, requires?: CommandSpec['requires'], maxWorkers?: number): CommandSpec {
  const outputFile = path.join(output, `jest-${id}.json`);
  const args = [
    path.join(root, JEST_CLI), '--config', config,
    ...(serial ? ['--runInBand'] : []),
    ...(!serial && maxWorkers ? [`--maxWorkers=${maxWorkers}`] : []),
    ...(files.length ? ['--runTestsByPath', ...files] : []),
    '--json', '--outputFile', outputFile,
  ];
  return { id, executable: 'node', args, cwd, reason, requires, reportPath: outputFile };
}

function pnpm(id: string, args: string[], reason: string, requires?: CommandSpec['requires'], env?: Record<string, string>): CommandSpec {
  return { id, executable: 'pnpm', args, reason, requires, env };
}

function e2eCommand(id: string, jestArgs: string[], reason: string, output: string): CommandSpec {
  const jsonReport = path.join(output, `jest-${id}.json`);
  const command = pnpm(id, ['test:e2e', '--', ...jestArgs], reason, ['test-targets'], {
    VERIFY_CHANGE_REPORT_DIR: output,
    VERIFY_CHANGE_JEST_REPORT: jsonReport,
  });
  command.reportPath = jsonReport;
  return command;
}
