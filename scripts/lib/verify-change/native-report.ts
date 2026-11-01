import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { redactNativeReport } from './safe-evidence';

interface SkipIdentity {
  runner: string;
  project?: string;
  file: string;
  title: string;
  reason?: string;
}

export interface NativeReportValidation {
  valid: boolean;
  details?: string;
  skips: string[];
}

interface ParsedCases {
  valid: boolean;
  error?: string;
  tests: Array<{ file: string; title: string }>;
  skips: SkipIdentity[];
  failures: number;
}

export async function validateNativeReport(file: string, commandId: string, root: string): Promise<NativeReportValidation> {
  await redactNativeReport(file);
  let report: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    report = parsed as Record<string, unknown>;
  } catch { return { valid: false, details: 'Native test report is malformed JSON or has an unsupported structure.', skips: [] }; }

  const playwright = commandId.toLowerCase().includes('browser') || path.basename(file).toLowerCase().includes('browser');
  const cases = playwright ? playwrightReportCases(report, root) : jestReportCases(report, root);
  if (!cases.valid) return { valid: false, details: cases.error, skips: [] };
  if (cases.tests.length === 0) return { valid: false, details: 'Native test report contains zero executed or skipped test cases.', skips: [] };
  if (cases.failures > 0) return { valid: false, details: `Native report records ${cases.failures} failed test case(s) despite a zero process exit.`, skips: cases.skips.map(formatSkip) };

  const baseline = readSkipBaseline(root);
  const unexpected = cases.skips.filter((actual) => !baseline.some((expected) => matchesSkip(expected, actual)));
  const runner = playwright ? 'playwright' : 'api-e2e';
  const missing = baseline.filter((expected) => expected.runner === runner &&
    cases.tests.some((test) => skipFileMatches(expected.file, test.file)) &&
    !cases.skips.some((actual) => matchesSkip(expected, actual)));
  const skipDetails = [
    ...unexpected.map((skip) => `Unexpected skip: ${formatSkip(skip)}`),
    ...missing.map((skip) => `Approved skip state changed: ${skip.file} - ${skip.title}`),
  ];
  return {
    valid: skipDetails.length === 0,
    details: skipDetails.length ? skipDetails.join('; ') : undefined,
    skips: cases.skips.map((actual) => {
      const approved = baseline.find((expected) => matchesSkip(expected, actual));
      return `${formatSkip(actual)}${approved?.reason ? ` (${approved.reason})` : ''}`;
    }),
  };
}

function jestReportCases(report: Record<string, unknown>, root: string): ParsedCases {
  if (!Array.isArray(report.testResults) || typeof report.numFailedTests !== 'number') {
    return { valid: false, error: 'Jest report is missing testResults or numFailedTests.', tests: [], skips: [], failures: 0 };
  }
  const tests: ParsedCases['tests'] = [];
  const skips: SkipIdentity[] = [];
  let countedFailures = 0;
  for (const suite of report.testResults) {
    if (!suite || typeof suite !== 'object') continue;
    const suiteRecord = suite as Record<string, unknown>;
    if (!Array.isArray(suiteRecord.assertionResults)) continue;
    const file = canonicalTestPath(root, typeof suiteRecord.name === 'string' ? suiteRecord.name : '');
    for (const item of suiteRecord.assertionResults) {
      if (!item || typeof item !== 'object') continue;
      const assertion = item as Record<string, unknown>;
      const title = typeof assertion.fullName === 'string' ? assertion.fullName : String(assertion.title ?? '');
      const status = String(assertion.status ?? '');
      tests.push({ file, title });
      if (status === 'failed') countedFailures += 1;
      if (status === 'pending' || status === 'todo' || status === 'skipped') skips.push({ runner: 'api-e2e', file, title });
    }
  }
  return { valid: true, tests, skips, failures: Math.max(report.numFailedTests, countedFailures) };
}

function playwrightReportCases(report: Record<string, unknown>, root: string): ParsedCases {
  if (!Array.isArray(report.suites)) return { valid: false, error: 'Playwright report is missing its suites array.', tests: [], skips: [], failures: 0 };
  const tests: ParsedCases['tests'] = [];
  const skips: SkipIdentity[] = [];
  let failures = 0;
  const addTests = (rawTests: unknown[], file: string, project: string) => {
    for (const rawTest of rawTests) {
      if (!rawTest || typeof rawTest !== 'object') continue;
      const test = rawTest as Record<string, unknown>;
      const title = String(test.title ?? '');
      const results = Array.isArray(test.results) ? test.results as Array<Record<string, unknown>> : [];
      const status = String(results.at(-1)?.status ?? test.expectedStatus ?? '');
      if (results.length > 0 || status === 'skipped' || status === 'interrupted') {
        tests.push({ file, title });
      }
      const testProject = typeof test.projectName === 'string' ? test.projectName : project;
      if (status === 'skipped' || status === 'interrupted') skips.push({ runner: 'playwright', project: testProject, file, title });
      if (status === 'failed' || status === 'timedOut') failures += 1;
    }
  };
  const visit = (suites: unknown[], parentFile = '', project = '') => {
    for (const raw of suites) {
      if (!raw || typeof raw !== 'object') continue;
      const suite = raw as Record<string, unknown>;
      const file = typeof suite.file === 'string' ? canonicalPlaywrightFile(root, suite.file) : parentFile;
      const suiteProject = typeof suite.projectName === 'string' ? suite.projectName : project;
      if (Array.isArray(suite.tests)) addTests(suite.tests, file, suiteProject);
      if (Array.isArray(suite.specs)) {
        for (const rawSpec of suite.specs) {
          if (!rawSpec || typeof rawSpec !== 'object') continue;
          const spec = rawSpec as Record<string, unknown>;
          if (!Array.isArray(spec.tests)) continue;
          const specFile = typeof spec.file === 'string' ? canonicalPlaywrightFile(root, spec.file) : file;
          addTests(spec.tests, specFile, suiteProject);
        }
      }
      if (Array.isArray(suite.suites)) visit(suite.suites, file, suiteProject);
    }
  };
  visit(report.suites as unknown[]);
  const stats = report.stats as Record<string, unknown> | undefined;
  if (stats && typeof stats.unexpected === 'number') failures = Math.max(failures, stats.unexpected);
  return { valid: true, tests, skips, failures };
}

function canonicalPlaywrightFile(root: string, file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const absolute = path.isAbsolute(file)
    ? path.resolve(file)
    : path.resolve(root, normalized.startsWith('e2e/') ? normalized : path.join('e2e', normalized));
  return path.relative(root, absolute).replace(/\\/g, '/');
}

function readSkipBaseline(root: string): SkipIdentity[] {
  try {
    const baseline = JSON.parse(readFileSync(path.join(root, 'tests/evaluation/test-inventory/baseline.json'), 'utf8')) as { approvedSkips?: SkipIdentity[] };
    return Array.isArray(baseline.approvedSkips) ? baseline.approvedSkips : [];
  } catch { return []; }
}

function matchesSkip(expected: SkipIdentity, actual: SkipIdentity): boolean {
  return expected.runner === actual.runner && (!expected.project || expected.project === actual.project) &&
    skipFileMatches(expected.file, actual.file) && normalizeTitle(expected.title) === normalizeTitle(actual.title);
}

function skipFileMatches(expected: string, actual: string): boolean {
  const expectedPath = expected.replace(/\\/g, '/');
  const actualPath = actual.replace(/\\/g, '/');
  return actualPath === expectedPath || actualPath.endsWith(`/${expectedPath}`) ||
    (!expectedPath.includes('/') && path.posix.basename(actualPath) === expectedPath);
}

function normalizeTitle(title: string): string { return title.replace(/[ \t\r\n]+/g, ' ').trim(); }
function formatSkip(skip: SkipIdentity): string { return `${skip.runner}${skip.project ? `/${skip.project}` : ''}:${skip.file}:${skip.title}`; }

function canonicalTestPath(root: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  return path.relative(root, absolute).replace(/\\/g, '/');
}
