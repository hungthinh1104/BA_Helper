import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { Project } from 'ts-morph';
import { scanProject } from '../../src';
import { TypeScriptNestJsAdapter } from '../../src/scanner/adapters/typescript-nestjs.adapter';
import { extractJestTestArtifacts } from '../../src/scanner/jest/jest-test-extractor';

describe('static Jest behavior evidence', () => {
  const commitSha = 'a'.repeat(40);

  it('extracts booking setup, input, action, mock, assertion and explicit outcomes with exact provenance', async () => {
    const root = realpathSync.native(join(__dirname, '../../../../tests/fixtures/jest-behavior/repo'));
    const file = join(root, 'test/refund-flow.spec.ts');
    const serviceFile = join(root, 'src/booking/booking.service.ts');
    const source = readFileSync(file, 'utf8');
    const adapter = new TypeScriptNestJsAdapter();
    const input = { rootDir: root, tsFiles: [serviceFile, file], commitSha };
    const result = await adapter.scan(input);
    const repeated = await adapter.scan(input);
    const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
    const claims = test.testCase?.behaviorEvidence ?? [];
    expect(repeated.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence).toEqual(claims);

    expect(new Set(claims.map(claim => claim.kind))).toEqual(new Set([
      'SETUP_HOOK', 'TEARDOWN_HOOK', 'INPUT', 'ACTION', 'MOCK', 'ASSERTION', 'EXPECTED_OUTCOME',
    ]));
    expect(claims.every(claim => claim.evidenceKind === 'STATIC_DECLARATION' && claim.commitSha === commitSha)).toBe(true);
    expect(claims.every(claim => claim.sourceLocation.relativePath === 'test/refund-flow.spec.ts')).toBe(true);
    for (const claim of claims) {
      expect(source.slice(claim.sourceLocation.startOffset, claim.sourceLocation.endOffset)).toBe(claim.sourceText);
      expect(lineColumn(source, claim.sourceLocation.startOffset)).toEqual({
        line: claim.sourceLocation.startLine, column: claim.sourceLocation.startColumn,
      });
      expect(lineColumn(source, claim.sourceLocation.endOffset)).toEqual({
        line: claim.sourceLocation.endLine, column: claim.sourceLocation.endColumn,
      });
    }
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('bookingRepository.insert'))).toBe(false);
    expect(claims.some(claim => claim.kind === 'SETUP_HOOK' && claim.sourceText.includes('bookingRepository.insert'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('cancelPaidBooking'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'INPUT' && claim.sourceText.includes('paidBooking'))).toBe(true);
    expect(claims.filter(claim => claim.kind === 'MOCK').map(claim => claim.sourceText)).toEqual(expect.arrayContaining([
      'jest.clearAllMocks()', 'jest.restoreAllMocks()',
    ]));
    expect(claims.find(claim => claim.kind === 'EXPECTED_OUTCOME')?.sourceText).toBe('request');
    expect(claims.find(claim => claim.kind === 'EXPECTED_OUTCOME')?.assertionKind).toBe('INVOCATION_ARGUMENTS');
    expect(result.dependencyEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'TESTS', toArtifactId: expect.stringContaining('BookingService.cancelPaidBooking') }),
    ]));
    expect(JSON.stringify(claims)).not.toMatch(/executed|passed|covered/i);
    expect(result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')).toEqual([]);
  });

  it('records parameterized source rows once without expanding them into runtime cases', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-each-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, test } from '@jest/globals';
test.each([{ status: 'REFUNDED' }, { status: 'DECLINED' }])('status %s', row => {
  expect(row.status).toBe('REFUNDED');
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      expect(cases).toHaveLength(1);
      expect(cases[0].testCase).toMatchObject({ parameterized: true });
      expect(cases[0].testCase?.behaviorEvidence).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'INPUT', sourceText: "[{ status: 'REFUNDED' }, { status: 'DECLINED' }]" }),
      ]));
      expect(cases[0].testCase?.behaviorEvidence?.filter(claim => claim.kind === 'EXPECTED_OUTCOME')).toMatchObject([
        { assertionKind: 'STATE', sourceText: "'REFUNDED'" },
      ]);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-each-');
    }
  });

  it('records AST-backed assertion to invocation associations for multiple results', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-association-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it } from '@jest/globals';
class Subject { run(value: string) { return value; } }
it('links each assertion', () => {
  const service = new Subject();
  const first = service.run('first');
  const second = service.run('second');
  expect(first).toBe('first');
  expect(second).toBe('second');
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      const claims = test.testCase?.behaviorEvidence ?? [];
      const actions = claims.filter(claim => claim.kind === 'ACTION');
      const assertions = claims.filter(claim => claim.kind === 'ASSERTION');
      expect(actions.map(claim => claim.sourceText)).toEqual(['service.run(\'first\')', 'service.run(\'second\')']);
      expect(assertions).toHaveLength(2);
      expect(assertions.every(claim => claim.relatedInvocationSourceLocation)).toBe(true);
      expect(assertions.map(claim => claim.relatedInvocationSourceLocation?.startOffset)).toEqual(
        actions.map(claim => claim.sourceLocation.startOffset));
      expect(assertions.map(claim => claim.relatedSubjectText)).toEqual(['first', 'second']);
      expect(result.diagnostics?.some(item => item.payload?.unsupportedPattern === 'ASSERTION_INVOCATION_UNRESOLVED')).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-association-');
    }
  });

  it('leaves an ambiguous reassigned assertion subject unresolved', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-association-ambiguous-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it } from '@jest/globals';
class Subject { run(value: string) { return value; } }
it('does not guess one assignment', () => {
  const service = new Subject();
  let result: string;
  result = service.run('first');
  result = service.run('second');
  expect(result).toBe('second');
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      const assertion = test.testCase?.behaviorEvidence?.find(claim => claim.kind === 'ASSERTION');
      expect(assertion?.relatedInvocationSourceLocation).toBeUndefined();
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          unsupportedPattern: 'ASSERTION_INVOCATION_UNRESOLVED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-association-ambiguous-');
    }
  });

  it('separates assertion semantics, validates chained mock identity, and keeps inherited setup out of actions', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-semantics-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it, jest } from '@jest/globals';
const gateway = { refund: jest.fn() };
beforeAll(() => { Test.createTestingModule({ providers: [] }).compile(); });
describe('refund', () => {
  beforeEach(() => { const module = Test.createTestingModule({ providers: [] }).compile(); module.get(RefundService); });
  it('classifies evidence', () => {
    const output = service.run();
    gateway.refund.mockResolvedValue('REFUNDED');
    expect(output).toEqual('ok');
    expect(state.status).toBe('REFUNDED');
    expect(gateway.refund).toHaveBeenNthCalledWith(2, 'payment-id', 7);
    expect(gateway.refund).toHaveBeenCalledTimes(3);
    expect(() => service.fail()).toThrow('failed');
    expect(state).toHaveProperty('status', 'PAID');
    business.mockResolvedValue('unknown mock');
    expect(output).toEventuallyBe('ok');
    service.wait(() => service.runNested());
  });
  it('does not trust a shadowed expect identifier', () => {
    const expect = (value: unknown) => ({ toBe: (_expected: unknown) => value });
    expect(1).toBe(1);
  });
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const claims = cases[0].testCase?.behaviorEvidence ?? [];
      expect(cases).toHaveLength(2);
      expect(claims.some(claim => claim.kind === 'SETUP_HOOK' && claim.sourceText.includes('Test.createTestingModule'))).toBe(true);
      expect(claims.some(claim => claim.kind === 'ACTION' && /Test\.createTestingModule|module\.get/.test(claim.sourceText))).toBe(false);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText === 'service.run()')).toBe(true);
      expect(claims.some(claim => claim.kind === 'MOCK' && claim.sourceText.includes('gateway.refund.mockResolvedValue'))).toBe(true);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('business.mockResolvedValue'))).toBe(false);
      expect(claims.filter(claim => claim.kind === 'EXPECTED_OUTCOME').map(claim => [claim.assertionKind, claim.sourceText]))
        .toEqual(expect.arrayContaining([
          ['RETURN_VALUE', "'ok'"], ['STATE', "'REFUNDED'"], ['CALL_COUNT', '2'],
          ['INVOCATION_ARGUMENTS', "'payment-id'"], ['INVOCATION_ARGUMENTS', '7'],
          ['CALL_COUNT', '3'], ['EXCEPTION', "'failed'"], ['STATE', "'status'"], ['STATE', "'PAID'"],
        ]));
      const unresolved = result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')
        .map(item => item.payload?.unsupportedPattern);
      expect(unresolved).toEqual(expect.arrayContaining([
        'MOCK_IDENTITY_UNRESOLVED', 'ASSERTION_SEMANTICS_UNRESOLVED', 'NESTED_CALLBACK_NOT_ANALYZED',
        'ASSERTION_IDENTITY_UNRESOLVED',
      ]));
      expect(cases[1].testCase?.behaviorEvidence?.some(claim => claim.kind === 'ASSERTION')).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-semantics-');
    }
  });

  it('does not classify typed Jest mock setup, asymmetric matchers, or data helpers as business actions', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-action-context-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it, jest } from '@jest/globals';
type Gateway = { refund(input: unknown): Promise<unknown> };
const mockedGateway: jest.Mocked<Gateway> = {} as jest.Mocked<Gateway>;
it('keeps setup and matchers out of actions', async () => {
  const request = Object.assign({ createdAt: Date.now() }, { status: 'PAID' });
  mockedGateway.refund.mockResolvedValue(Object.assign({}, request));
  await expect(subject.refund(request)).resolves.toMatchObject({
    status: expect.any(String),
    values: expect.arrayContaining([expect.any(Number)]),
  });
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      const actions = claims.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText);
      expect(actions).toEqual(['subject.refund(request)']);
      expect(claims.some(claim => claim.kind === 'MOCK' &&
        claim.sourceText.includes('mockedGateway.refund.mockResolvedValue'))).toBe(true);
      expect(claims.filter(claim => claim.kind === 'EXPECTED_OUTCOME').map(claim => claim.sourceText))
        .toContain("{\n    status: expect.any(String),\n    values: expect.arrayContaining([expect.any(Number)]),\n  }");
      expect(actions.some(text => /Object\.assign|Date\.now|expect\.(?:any|arrayContaining)|mockResolvedValue/.test(text))).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-action-context-');
    }
  });

  it('keeps imported data builders and external fluent assertions out of business actions', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-action-receiver-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it } from '@jest/globals';
import fc from 'fast-check';
import { spec } from 'pactum';
import { makeInput, makeExpected } from './test-data';
import { refundFactory } from './fixture';
import { importedSubject } from './subject';
class Subject { refund(_input: unknown) { return 'REFUNDED'; } }
const subject = new Subject();
it('separates subject calls from preparation and fluent test APIs', async () => {
  const input = refundFactory.buildOne();
  const expected = makeExpected();
  await fc.assert(fc.property(fc.integer(), value => value > 0));
  await spec().post('/refund').withBody(input).expectStatus(201).toss();
  const actual = subject.refund(makeInput());
  expect(actual).toEqual(makeExpected());
  expect(importedSubject.refund(input)).toBe(expected);
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      const actions = claims.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText);
      expect(actions).toEqual(['subject.refund(makeInput())', 'importedSubject.refund(input)']);
      expect(claims.every(claim => claim.evidenceKind === 'STATIC_DECLARATION' && claim.commitSha === commitSha)).toBe(true);
      expect(result.diagnostics?.some(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED' &&
        item.payload?.unsupportedPattern === 'ACTION_RECEIVER_UNRESOLVED')).toBe(true);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-action-receiver-');
    }
  });

  it('does not turn local test clients, backups, mock callbacks, or DTO builders into actions', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-indirect-utility-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { agent } from 'supertest';
import { e2e } from 'pactum';
import { back } from 'nock';
import { database } from './database';
class DTO { static from(data: unknown) { return data; } }
class Subject { refund(_input: unknown) { return 'ok'; } }
const subject = new Subject();
const testCase = e2e('refund');
it('uses a subject and several test utilities', async () => {
  const client = agent(server);
  const backup = database.backup();
  const { nockDone } = await back('refund.json');
  const title = 'Paid Booking';
  const slug = title.toLowerCase().replaceAll(' ', '-');
  const longText = 'A'.repeat(2000);
  const dto = DTO.from({ slug });
  await client.post('/refund').expect(200);
  await testCase.step('refund').spec().post('/refund').toss();
  await testCase${'.step("refund")'.repeat(20)}.toss();
  backup.restore();
  nockDone();
  expect(subject.refund(dto)).toBe('ok');
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText))
        .toEqual(['subject.refund(dto)']);
      expect(result.diagnostics?.some(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED' &&
        item.payload?.unsupportedPattern === 'ACTION_RECEIVER_UNRESOLVED')).toBe(true);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-indirect-utility-');
    }
  });

  it('retains a constructed subject action inside an external async wrapper', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-wrapped-action-')));
    try {
      const file = join(root, 'interceptor.spec.ts');
      writeFileSync(file, `import { lastValueFrom } from 'rxjs';
import { Test } from '@nestjs/testing';
import { CurrentUserInterceptor } from './current-user.interceptor';
let assigned: CurrentUserInterceptor;
beforeEach(async () => {
  const module = await Test.createTestingModule({ providers: [CurrentUserInterceptor] }).compile();
  assigned = module.get(CurrentUserInterceptor);
});
it('intercepts', async () => {
  const interceptor = new CurrentUserInterceptor();
  await lastValueFrom(interceptor.intercept(context, next));
});
it('intercepts after setup assignment', async () => {
  await lastValueFrom(assigned.intercept(context, next));
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const claims = cases[0].testCase?.behaviorEvidence ?? [];
      expect(claims.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText))
        .toEqual(['interceptor.intercept(context, next)']);
      expect(cases[1].testCase?.behaviorEvidence?.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText))
        .toEqual(['assigned.intercept(context, next)']);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-wrapped-action-');
    }
  });

  it('retains a direct action on a class token resolved from a testing module', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-token-action-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { Test } from '@nestjs/testing';
import { RefundService } from './refund.service';
it('refunds', async () => {
  const module = await Test.createTestingModule({ providers: [RefundService] }).compile();
  const service = module.get<RefundService>(RefundService);
  service.refund();
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims.filter(claim => claim.kind === 'ACTION').map(claim => claim.sourceText))
        .toEqual(['service.refund()']);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-token-action-');
    }
  });

  it('records only verified Jest throw callback actions with exact static provenance', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-throw-action-')));
    try {
      const file = join(root, 'throw.spec.ts');
      const source = `import { expect, it } from '@jest/globals';
it('throws', () => {
  expect(() => service.fail()).toThrowError('failed');
  const action = () => service.reject();
  expect(action).not.toThrow();
  expect(() => setTimeout(() => service.later(), 0)).toThrow();
  const unused = () => service.notObserved();
});
it('shadows expect', () => {
  const expect = (value: unknown) => ({ toThrow: () => value });
  expect(() => service.shadowed()).toThrow();
});`;
      writeFileSync(file, source);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const actions = cases[0].testCase?.behaviorEvidence?.filter(claim => claim.kind === 'ACTION') ?? [];
      expect(actions.map(claim => claim.sourceText)).toEqual(['service.fail()', 'service.reject()']);
      expect(actions.every(claim => claim.evidenceKind === 'STATIC_DECLARATION' && claim.commitSha === commitSha &&
        source.slice(claim.sourceLocation.startOffset, claim.sourceLocation.endOffset) === claim.sourceText)).toBe(true);
      expect(cases[1].testCase?.behaviorEvidence?.some(claim => claim.kind === 'ACTION')).toBe(false);
      expect(result.diagnostics?.some(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED' &&
        item.payload?.unsupportedPattern === 'NESTED_CALLBACK_NOT_ANALYZED')).toBe(true);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-throw-action-');
    }
  });

  it('keeps inherited setup declarations distinct from a nested test action', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-inherited-setup-')));
    try {
      const file = join(root, 'nested.spec.ts');
      const source = `describe('outer', () => {
  beforeEach(() => { harness.prepare(); });
  describe('inner', () => {
    it('runs the operation', () => subject.run());
  });
});`;
      writeFileSync(file, source);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      const claims = test.testCase?.behaviorEvidence ?? [];
      expect(claims.some(claim => claim.kind === 'SETUP_HOOK' && claim.sourceText.includes('harness.prepare'))).toBe(true);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText === 'harness.prepare()')).toBe(false);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText === 'subject.run()')).toBe(true);
      expect(claims.every(claim => source.slice(claim.sourceLocation.startOffset, claim.sourceLocation.endOffset) ===
        claim.sourceText)).toBe(true);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-inherited-setup-');
    }
  });

  it('reports unsupported callbacks, dynamic matchers and snapshots without inventing claims', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-negative-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `beforeEach(makeSetup());
it('does not imply runtime execution', () => {
  setTimeout(() => subject.execute(), 0);
  expect(subject.value)[matcher](42);
  expect(subject.value).toMatchSnapshot();
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      const patterns = result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')
        .map(item => item.payload?.unsupportedPattern);
      expect(patterns).toEqual(expect.arrayContaining([
        'NESTED_CALLBACK_NOT_ANALYZED', 'DYNAMIC_MATCHER_NOT_ANALYZED', 'SNAPSHOT_EXPECTATION_UNRESOLVED',
        'UNSUPPORTED_SETUP_HOOK',
      ]));
      expect(claims.some(claim => claim.sourceText.includes('subject.execute'))).toBe(false);
      expect(claims.some(claim => claim.sourceText.includes('[matcher]'))).toBe(false);
      expect(claims.some(claim => claim.kind === 'EXPECTED_OUTCOME' && claim.sourceText.includes('Snapshot'))).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-negative-');
    }
  });

  it('withholds claims and diagnoses behavior when commit context is absent', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-context-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, "it('refunds', () => { expect(service.refund()).toBe('REFUNDED'); });");
      const result = scanProject({ fixturePath: root, tsFiles: [file] });
      const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      expect(test.testCase?.behaviorEvidence).toBeUndefined();
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          relativePath: 'refund.spec.ts', unsupportedPattern: 'COMMIT_CONTEXT_REQUIRED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-context-');
    }
  });

  it('caps claims per test case and reports omitted declarations', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-limit-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const assertions = Array.from({ length: 60 }, (_, index) => `expect(value).toBe(${index});`).join('\n');
      writeFileSync(file, `it('bounded', () => {\n${assertions}\n});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims).toHaveLength(100);
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          unsupportedPattern: 'CLAIM_LIMIT_EXCEEDED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-limit-');
    }
  });

  it('applies the source excerpt limit after secret redaction', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-redaction-limit-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const accessKey = `AKIA${'A'.repeat(16)}`;
      const paddedOutcome = `${accessKey}${'x'.repeat(1977)}`;
      writeFileSync(file, `it('redacts', () => { expect(value).toBe('${paddedOutcome}'); });`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims.some(claim => claim.kind === 'EXPECTED_OUTCOME')).toBe(false);
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          unsupportedPattern: 'SOURCE_TEXT_LIMIT_EXCEEDED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-redaction-limit-');
    }
  });

  it('enforces the shared scan claim budget and reports omitted declarations', () => {
    const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true,
      compilerOptions: { noResolve: true, noLib: true } });
    const file = project.createSourceFile('refund.spec.ts', "it('limited', () => { expect(1).toBe(1); });");
    const result = extractJestTestArtifacts(file, 'refund.spec.ts', commitSha, { remaining: 1 });
    const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
    expect(claims).toHaveLength(1);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
        unsupportedPattern: 'SCAN_CLAIM_LIMIT_EXCEEDED',
      }) }),
    ]));
  });

  it('includes setup behavior in incremental content hashes without making line offsets identity', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-hash-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const scan = (source: string) => {
        writeFileSync(file, source);
        return scanProject({ fixturePath: root, tsFiles: [file], commitSha })
          .artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      };
      const original = scan(`beforeEach(() => { const booking = { status: 'PAID' }; });
it('refunds', () => {});`);
      const shifted = scan(`// source location shifts
beforeEach(() => { const booking = { status: 'PAID' }; });
it('refunds', () => {});`);
      const changed = scan(`beforeEach(() => { const booking = { status: 'CANCELLED' }; });
it('refunds', () => {});`);
      expect(shifted.stableId).toBe(original.stableId);
      expect(shifted.contentHash).toBe(original.contentHash);
      expect(changed.stableId).toBe(original.stableId);
      expect(changed.contentHash).not.toBe(original.contentHash);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-hash-');
    }
  });

  it('keeps deterministic bounded extraction under a large test file', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-perf-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const tests = Array.from({ length: 250 }, (_, index) =>
        `it('case ${index}', () => { const input = ${index}; expect(input).toBe(${index}); });`).join('\n');
      writeFileSync(file, tests);
      const startedAt = Date.now();
      const first = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const second = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const elapsedMs = Date.now() - startedAt;
      const firstCases = first.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const secondCases = second.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      expect(firstCases).toHaveLength(250);
      expect(firstCases.map(item => item.contentHash)).toEqual(secondCases.map(item => item.contentHash));
      expect(firstCases.every(item => item.testCase?.behaviorEvidence?.length === 3)).toBe(true);
      expect(elapsedMs).toBeLessThan(5000);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-perf-');
    }
  });
});

function removeTempDirectory(root: string, prefix: string): void {
  const name = relative(realpathSync.native(tmpdir()), root);
  if (!name.startsWith(prefix) || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
  rmSync(root, { recursive: true, force: true });
}

function lineColumn(source: string, offset: number): { line: number; column: number } {
  const lines = source.slice(0, offset).split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}
