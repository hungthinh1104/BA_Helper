import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { redactNativeReport } from './safe-evidence';

export interface NativeExpectedCase {
  file: string;
  title: string;
  project?: string;
}

export interface NativeReportExpectation {
  runner: 'jest' | 'playwright';
  files: string[];
  cases?: NativeExpectedCase[];
  discoveryError?: string;
}

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
  expectedExecution: { runner: 'jest' | 'playwright'; files: string[]; cases: number | null };
  observedExecution: { files: string[]; cases: number; executedCases: number; skippedCases: number };
  skipExpectations: Array<{ identity: string; state: 'SKIP_REQUIRED' | 'EXECUTION_REQUIRED'; observed: 'SKIPPED' | 'EXECUTED' | 'MISSING' }>;
  retryFailures: Array<{ identity: string; failedAttempts: number; finalStatus: string }>;
  qualificationReasons: string[];
}

interface ParsedCase extends NativeExpectedCase {
  runner: 'api-e2e' | 'playwright';
  status: string;
  executed: boolean;
  skipped: boolean;
}

interface ParsedReport {
  valid: boolean;
  issues: string[];
  cases: ParsedCase[];
  retryFailures: NativeReportValidation['retryFailures'];
  failures: number;
}

interface SkipBaseline {
  valid: boolean;
  skips: SkipIdentity[];
}

const JEST_STATUSES = new Set(['passed', 'failed', 'pending', 'todo', 'disabled', 'skipped']);
const PLAYWRIGHT_RESULT_STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);

export async function validateNativeReport(
  file: string,
  commandId: string,
  root: string,
  expectation: NativeReportExpectation,
  env: NodeJS.ProcessEnv = process.env,
): Promise<NativeReportValidation> {
  await redactNativeReport(file);
  let report: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    report = parsed as Record<string, unknown>;
  } catch {
    const reason = 'Native test report is malformed JSON or has an unsupported structure.';
    return invalidReport(expectation, [reason, expectation.discoveryError].filter(Boolean).join('; '));
  }

  const playwright = expectation.runner === 'playwright' || commandId.toLowerCase().includes('browser') ||
    path.basename(file).toLowerCase().includes('browser');
  const runner = playwright ? 'playwright' : 'jest';
  const parsed = playwright ? playwrightReportCases(report, root) : jestReportCases(report, root);
  const reasons = [...parsed.issues];
  if (expectation.discoveryError) reasons.push(expectation.discoveryError);
  if (!parsed.valid && parsed.issues.length === 0) reasons.push('Native test report has an unsupported structure.');

  const expectedFiles = unique(expectation.files.map((item) => canonicalFile(root, item)));
  const observedFiles = unique(parsed.cases.map((item) => canonicalFile(root, item.file)));
  const missingFiles = expectedFiles.filter((item) => !observedFiles.includes(item));
  if (missingFiles.length) reasons.push(`Selected test suite(s) are absent from the native report: ${missingFiles.join(', ')}.`);

  const expectedCases = expectation.cases ?? [];
  const expectedCaseIds = new Set(expectedCases.map((item) => caseIdentity(root, item, runner)));
  const observedCaseIds = new Set(parsed.cases.map((item) => caseIdentity(root, item, runner)));
  const missingCases = [...expectedCaseIds].filter((item) => !observedCaseIds.has(item));
  if (missingCases.length) reasons.push(`Selected test case(s) are absent from the native report: ${missingCases.slice(0, 12).join(', ')}${missingCases.length > 12 ? ', …' : ''}.`);

  const executedCases = parsed.cases.filter((item) => item.executed).length;
  const skippedCases = parsed.cases.filter((item) => item.skipped).length;
  if (executedCases === 0) reasons.push('Native test report contains zero executed test cases.');
  if (parsed.failures > 0) reasons.push(`Native report records ${parsed.failures} failed test case(s) or attempt(s).`);
  if (parsed.retryFailures.length) reasons.push(`Native report contains ${parsed.retryFailures.length} test(s) recovered by retry; flaky recovery is not qualified.`);

  const baseline = readSkipBaseline(root);
  if (!baseline.valid) reasons.push('The tracked approved-skip inventory is malformed or unavailable.');
  const actualSkips = parsed.cases.filter((item) => item.skipped);
  const actualSkipIdentities = actualSkips.map((item) => toSkipIdentity(item, runner));
  const unexpected = actualSkipIdentities.filter((actual) => !baseline.skips.some((approved) => matchesSkip(approved, actual)));
  for (const skip of unexpected) reasons.push(`Unexpected skip: ${formatSkip(skip)}`);

  const skipExpectations: NativeReportValidation['skipExpectations'] = [];
  const relevantApproved = baseline.skips.filter((skip) => skip.runner === (playwright ? 'playwright' : 'api-e2e') &&
    (skip.project === undefined || expectedCases.some((item) => item.project === skip.project && skipFileMatches(skip.file, item.file))) &&
    (expectedCases.length > 0
      ? expectedCases.some((item) => skipFileMatches(skip.file, item.file) && normalizeTitle(item.title).endsWith(normalizeTitle(skip.title)))
      : expectedFiles.some((item) => skipFileMatches(skip.file, item))));

  for (const approved of relevantApproved) {
    const active = skipActivationEnabled(approved, env);
    const actual = actualSkipIdentities.find((item) => matchesSkip(approved, item));
    const executed = parsed.cases.some((item) => matchesSkip(approved, toSkipIdentity(item, runner)) && item.executed);
    const observed = actual ? 'SKIPPED' : executed ? 'EXECUTED' : 'MISSING';
    const state = active ? 'EXECUTION_REQUIRED' : 'SKIP_REQUIRED';
    skipExpectations.push({ identity: formatSkip(approved), state, observed });
    if (!active && observed !== 'SKIPPED') reasons.push(`Approved opt-in case must remain skipped while inactive: ${formatSkip(approved)}.`);
    if (active && observed !== 'EXECUTED') reasons.push(`Approved opt-in case must execute while activated: ${formatSkip(approved)}.`);
  }

  const skips = actualSkipIdentities.map((actual) => {
    const approved = baseline.skips.find((expected) => matchesSkip(expected, actual));
    return `${formatSkip(actual)}${approved?.reason ? ` (${approved.reason})` : ''}`;
  });
  return {
    valid: reasons.length === 0,
    details: reasons.length ? unique(reasons).join('; ') : undefined,
    skips,
    expectedExecution: { runner, files: expectedFiles, cases: expectation.cases ? expectation.cases.length : null },
    observedExecution: { files: observedFiles, cases: parsed.cases.length, executedCases, skippedCases },
    skipExpectations,
    retryFailures: parsed.retryFailures,
    qualificationReasons: unique(reasons),
  };
}

function invalidReport(expectation: NativeReportExpectation, reason: string): NativeReportValidation {
  return {
    valid: false, details: reason, skips: [],
    expectedExecution: { runner: expectation.runner, files: unique(expectation.files), cases: expectation.cases ? expectation.cases.length : null },
    observedExecution: { files: [], cases: 0, executedCases: 0, skippedCases: 0 },
    skipExpectations: [], retryFailures: [], qualificationReasons: [reason],
  };
}

function jestReportCases(report: Record<string, unknown>, root: string): ParsedReport {
  const issues: string[] = [];
  const cases: ParsedCase[] = [];
  if (!Array.isArray(report.testResults)) issues.push('Jest report is missing its testResults array.');
  for (const rawSuite of Array.isArray(report.testResults) ? report.testResults : []) {
    if (!rawSuite || typeof rawSuite !== 'object' || Array.isArray(rawSuite)) {
      issues.push('Jest report contains a malformed suite record.');
      continue;
    }
    const suite = rawSuite as Record<string, unknown>;
    if (typeof suite.name !== 'string' || !suite.name || !Array.isArray(suite.assertionResults)) {
      issues.push('Jest suite is missing its file identity or assertionResults array.');
      continue;
    }
    const file = canonicalTestPath(root, suite.name);
    for (const rawAssertion of suite.assertionResults) {
      if (!rawAssertion || typeof rawAssertion !== 'object' || Array.isArray(rawAssertion)) {
        issues.push(`Jest suite ${file} contains a malformed assertion record.`);
        continue;
      }
      const assertion = rawAssertion as Record<string, unknown>;
      const status = typeof assertion.status === 'string' ? assertion.status : '';
      const title = typeof assertion.fullName === 'string' ? assertion.fullName : String(assertion.title ?? '');
      if (!JEST_STATUSES.has(status)) {
        issues.push(`Jest assertion has an unknown status${title ? ` (${title})` : ''}.`);
        continue;
      }
      cases.push({ runner: 'api-e2e', file, title, status, executed: status === 'passed' || status === 'failed', skipped: ['pending', 'todo', 'disabled', 'skipped'].includes(status) });
    }
  }
  const counted = {
    total: cases.length,
    passed: cases.filter((item) => item.status === 'passed').length,
    failed: cases.filter((item) => item.status === 'failed').length,
    pending: cases.filter((item) => item.status === 'pending' || item.status === 'disabled' || item.status === 'skipped').length,
    todo: cases.filter((item) => item.status === 'todo').length,
  };
  for (const [key, actual] of Object.entries(counted)) {
    const reported = report[key === 'total' ? 'numTotalTests' : key === 'passed' ? 'numPassedTests' : key === 'failed' ? 'numFailedTests' : key === 'pending' ? 'numPendingTests' : 'numTodoTests'];
    if (typeof reported !== 'number') {
      if (key === 'total' || key === 'failed') issues.push(`Jest report is missing the ${key} assertion count.`);
    } else if (reported !== actual) issues.push(`Jest ${key} count ${reported} does not match ${actual} parsed assertion(s).`);
  }
  if (report.success === false) issues.push('Jest report marks the invocation unsuccessful.');
  if (typeof report.numFailedTestSuites === 'number' && report.numFailedTestSuites > 0) issues.push(`Jest reports ${report.numFailedTestSuites} failed test suite(s).`);
  return { valid: issues.length === 0, issues, cases, retryFailures: [], failures: counted.failed };
}

function playwrightReportCases(report: Record<string, unknown>, root: string): ParsedReport {
  const issues: string[] = [];
  const cases: ParsedCase[] = [];
  const retryFailures: NativeReportValidation['retryFailures'] = [];
  if (!Array.isArray(report.suites)) return { valid: false, issues: ['Playwright report is missing its suites array.'], cases, retryFailures, failures: 0 };

  const visit = (suites: unknown[], parentFile = '', project = '', ancestry: string[] = []) => {
    for (const raw of suites) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        issues.push('Playwright report contains a malformed suite record.');
        continue;
      }
      const suite = raw as Record<string, unknown>;
      const hasFile = typeof suite.file === 'string';
      const file = hasFile ? canonicalPlaywrightFile(root, suite.file as string) : parentFile;
      const suiteProject = typeof suite.projectName === 'string' ? suite.projectName : project;
      const suiteTitles = hasFile ? ancestry : parentFile
        ? [...ancestry, ...(typeof suite.title === 'string' && suite.title ? [suite.title] : [])]
        : ancestry;
      if (Array.isArray(suite.specs)) {
        for (const rawSpec of suite.specs) {
          if (!rawSpec || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
            issues.push(`Playwright suite ${file} contains a malformed spec record.`);
            continue;
          }
          const spec = rawSpec as Record<string, unknown>;
          const specFile = typeof spec.file === 'string' ? canonicalPlaywrightFile(root, spec.file) : file;
          const title = [...suiteTitles, ...(typeof spec.title === 'string' && spec.title ? [spec.title] : [])].join(' › ');
          if (!title || !Array.isArray(spec.tests)) {
            issues.push(`Playwright spec in ${specFile} is missing its title or tests array.`);
            continue;
          }
          for (const rawTest of spec.tests) {
            if (!rawTest || typeof rawTest !== 'object' || Array.isArray(rawTest)) {
              issues.push(`Playwright spec ${title} contains a malformed project test record.`);
              continue;
            }
            const test = rawTest as Record<string, unknown>;
            const testProject = typeof test.projectName === 'string' ? test.projectName : suiteProject;
            if (!testProject) issues.push(`Playwright test ${title} is missing its project identity.`);
            const results = Array.isArray(test.results) ? test.results.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
            if (Array.isArray(test.results) && results.length !== test.results.length) issues.push(`Playwright test ${title} contains a malformed result attempt.`);
            if (!Array.isArray(test.results)) issues.push(`Playwright test ${title} is missing its result history.`);
            const statuses = results.map((result) => typeof result.status === 'string' ? result.status : '');
            for (const status of statuses) if (!PLAYWRIGHT_RESULT_STATUSES.has(status)) issues.push(`Playwright test ${title} has an unknown result status (${status || 'missing'}).`);
            const testStatus = typeof test.status === 'string' ? test.status : '';
            const skipped = testStatus === 'skipped' || (results.length === 0 && test.expectedStatus === 'passed');
            if (!['expected', 'unexpected', 'flaky', 'skipped'].includes(testStatus)) issues.push(`Playwright test ${title} has an unknown aggregate status (${testStatus || 'missing'}).`);
            if (!skipped && results.length === 0) issues.push(`Playwright test ${title} has no result attempt despite not being skipped.`);
            const attemptStatus = statuses.at(-1) ?? (skipped ? 'skipped' : '');
            const resultStatus = testStatus === 'expected' ? 'passed'
              : testStatus === 'unexpected' ? 'failed'
                : testStatus === 'skipped' ? 'skipped'
                  : attemptStatus;
            const executed = results.length > 0 && statuses.some((status) => status === 'passed' || status === 'failed' || status === 'timedOut');
            const identity = `${testProject}:${specFile}:${title}`;
            const failedAttempts = statuses.filter((status) => status === 'failed' || status === 'timedOut' || status === 'interrupted').length;
            if ((failedAttempts > 0 && resultStatus === 'passed') || testStatus === 'flaky') {
              retryFailures.push({ identity, failedAttempts: Math.max(1, failedAttempts), finalStatus: resultStatus || testStatus });
            }
            cases.push({ runner: 'playwright', project: testProject, file: specFile, title, status: resultStatus, executed, skipped });
          }
        }
      }
      if (Array.isArray(suite.suites)) visit(suite.suites, file, suiteProject, suiteTitles);
      if (Array.isArray(suite.tests)) {
        issues.push(`Playwright report uses unsupported legacy test records for ${file}; expected specs[].tests[].`);
      }
    }
  };
  visit(report.suites as unknown[]);
  const stats = report.stats && typeof report.stats === 'object' && !Array.isArray(report.stats)
    ? report.stats as Record<string, unknown> : undefined;
  if (!stats) issues.push('Playwright report is missing its stats object.');
  else {
    for (const key of ['expected', 'skipped', 'unexpected', 'flaky'] as const) {
      if (typeof stats[key] !== 'number') issues.push(`Playwright report is missing stats.${key}.`);
    }
    const counts = {
      expected: cases.filter((item) => item.executed && item.status === 'passed' &&
        !retryFailures.some((failure) => failure.identity === `${item.project}:${item.file}:${item.title}`)).length,
      skipped: cases.filter((item) => item.skipped).length,
      unexpected: cases.filter((item) => item.status === 'failed' || item.status === 'timedOut' || item.status === 'interrupted').length,
      flaky: retryFailures.length,
    };
    for (const [key, actual] of Object.entries(counts)) {
      const reported = stats[key];
      if (typeof reported === 'number' && reported !== actual) issues.push(`Playwright stats.${key} ${reported} does not match ${actual} parsed test(s).`);
    }
    if (typeof stats.unexpected === 'number' && stats.unexpected > 0) issues.push(`Playwright reports ${stats.unexpected} unexpected test(s).`);
    if (typeof stats.flaky === 'number' && stats.flaky > 0 && retryFailures.length === 0) issues.push(`Playwright reports ${stats.flaky} flaky test(s) without retry-history details.`);
  }
  const failures = cases.reduce((sum, item) => sum + (item.status === 'failed' || item.status === 'timedOut' || item.status === 'interrupted' ? 1 : 0), 0) + retryFailures.length;
  return { valid: issues.length === 0, issues, cases, retryFailures, failures };
}

function readSkipBaseline(root: string): SkipBaseline {
  try {
    const baseline = JSON.parse(readFileSync(path.join(root, 'tests/evaluation/test-inventory/baseline.json'), 'utf8')) as { approvedSkips?: SkipIdentity[] };
    if (!Array.isArray(baseline.approvedSkips) || baseline.approvedSkips.some((item) => !item || typeof item.runner !== 'string' || typeof item.file !== 'string' || typeof item.title !== 'string' || typeof item.reason !== 'string')) {
      return { valid: false, skips: [] };
    }
    return { valid: true, skips: baseline.approvedSkips };
  } catch { return { valid: false, skips: [] }; }
}

function skipActivationEnabled(skip: SkipIdentity, env: NodeJS.ProcessEnv): boolean {
  if (skip.runner === 'api-e2e' && skip.file.includes('edukids-pinned-pilot')) return env.EDUKIDS_PILOT_REAL_SCAN === 'true';
  if (skip.runner === 'playwright' && skip.file.includes('pinned-real-comprehension')) return env.REQUIRE_PINNED_COMPREHENSION_PROOF === '1';
  return false;
}

function toSkipIdentity(item: ParsedCase, runner: 'jest' | 'playwright'): SkipIdentity {
  return { runner: runner === 'playwright' ? 'playwright' : 'api-e2e', project: item.project, file: item.file, title: item.title };
}

function matchesSkip(expected: SkipIdentity, actual: SkipIdentity): boolean {
  return expected.runner === actual.runner && (!expected.project || expected.project === actual.project) &&
    skipFileMatches(expected.file, actual.file) && normalizeTitle(expected.title) === normalizeTitle(actual.title);
}

function caseIdentity(root: string, item: NativeExpectedCase, runner: 'jest' | 'playwright'): string {
  const file = runner === 'playwright' ? canonicalPlaywrightFile(root, item.file) : canonicalTestPath(root, item.file);
  return `${item.project ?? ''}:${file}:${normalizeTitle(item.title)}`;
}

function skipFileMatches(expected: string, actual: string): boolean {
  const expectedPath = expected.replace(/\\/g, '/');
  const actualPath = actual.replace(/\\/g, '/');
  return actualPath === expectedPath || actualPath.endsWith(`/${expectedPath}`) ||
    (!expectedPath.includes('/') && path.posix.basename(actualPath) === expectedPath);
}

function normalizeTitle(title: string): string { return title.replace(/[ \t\r\n]+/g, ' ').trim(); }
function formatSkip(skip: SkipIdentity): string { return `${skip.runner}${skip.project ? `/${skip.project}` : ''}:${skip.file}:${skip.title}`; }
function canonicalFile(root: string, file: string): string { return file.replace(/\\/g, '/').replace(new RegExp(`^${escapeRegExp(root.replace(/\\/g, '/'))}/?`, 'i'), ''); }
function canonicalTestPath(root: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  return path.relative(root, absolute).replace(/\\/g, '/');
}
export function canonicalPlaywrightFile(root: string, file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const absolute = path.isAbsolute(file)
    ? path.resolve(file)
    : path.resolve(root, normalized.startsWith('e2e/') ? normalized : path.join('e2e', normalized));
  return path.relative(root, absolute).replace(/\\/g, '/');
}
function unique(items: string[]): string[] { return [...new Set(items)]; }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
