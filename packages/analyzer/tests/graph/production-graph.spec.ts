import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildGraph, createGraphEdgeId, SafeFileEnumerator, scanProject } from '../../src';
import { TypeScriptNestJsAdapter } from '../../src/scanner/adapters/typescript-nestjs.adapter';
import { ScannedModuleResolver } from '../../src/graph/scanned-module-resolver';

describe('source-backed production graph', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ba-graph-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  function source(path: string, content: string): string {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
    return absolute;
  }

  const payment = `import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentService {
  authorize() {}
  refund() {}
}`;

  it('returns the booking CALLS/TESTS edges through the real adapter', async () => {
    const fixture = resolve(__dirname, '../../../../tests/fixtures/nestjs-booking-with-payment');
    const files = await new SafeFileEnumerator(fixture).enumerate();
    const result = await new TypeScriptNestJsAdapter().scan({ rootDir: fixture, tsFiles: files.tsFiles });
    const triples = result.dependencyEdges.map(e => `${e.fromArtifactId}|${e.type}|${e.toArtifactId}`);
    const test = result.artifacts.find(a => a.type === 'JEST_TEST_CASE')!;
    const bookingMethod = result.artifacts.find(a => a.symbolName === 'BookingService.cancelBooking')!;
    expect(triples).toHaveLength(7);
    expect(triples.some(triple => triple.includes('|CALLS|'))).toBe(true);
    expect(result.dependencyEdges.some(edge => edge.fromArtifactId === test.stableId && edge.type === 'TESTS' &&
      edge.toArtifactId === bookingMethod.stableId)).toBe(true);
    expect(result.dependencyEdges.every(e => e.confidence === 1 && e.provenance?.locations.length)).toBe(true);
  });

  it('creates distinct deterministic edge IDs for endpoint/type tuples', () => {
    const ids = [
      createGraphEdgeId('a->b', 'CALLS', 'c'),
      createGraphEdgeId('a', 'CALLS', 'b->c'),
      createGraphEdgeId('a', 'TESTS', 'b'),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      createGraphEdgeId('a->b', 'CALLS', 'c'),
      createGraphEdgeId('a', 'CALLS', 'b->c'),
      createGraphEdgeId('a', 'TESTS', 'b'),
    ]);
  });

  it('does not assign an imported class to its first method or match unrelated receivers', () => {
    const service = source('src/payment.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './payment.service';
const unrelated = { refund() {} };
describe('payment', () => { it('does something', () => unrelated.refund()); });`);
    const result = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test] }));
    expect(result.edges.filter(e => e.type === 'TESTS')).toEqual([]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TEST_TARGET_UNRESOLVED', filePath: 'src/payment.spec.ts' }),
    ]));
  });

  it('does not replace an unresolved CALLS target with another method', () => {
    const service = source('src/payment.service.ts', payment);
    const booking = source('src/booking.service.ts', `import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment.service';
@Injectable() export class BookingService {
  constructor(private payment: PaymentService) {}
  cancel() { this.payment.missing(); }
}`);
    const result = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, booking] }));
    expect(result.edges.filter(e => e.type === 'CALLS')).toEqual([]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNRESOLVED_METHOD_TARGET' }),
    ]));
  });

  it('resolves aliased imports and scoped instances, preserving repeated call locations', () => {
    const service = source('src/payment.service.ts', payment);
    const other = source('src/other.service.ts', payment.replace('authorize()', 'other()'));
    const test = source('src/payment.spec.ts', `import { PaymentService as Subject } from './payment.service';
import { PaymentService as Other } from './other.service';
it('refund', () => {
  const service = new Subject();
  service.refund();
  service.refund();
  { const service = new Other(); service.other(); }
});`);
    const result = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, other, test] }));
    const refund = result.edges.find(e => e.type === 'TESTS' && e.to.includes('PaymentService.refund'));
    expect(refund?.provenance?.locations).toEqual([
      { sourcePath: 'src/payment.spec.ts', startLine: 5, endLine: 5 },
      { sourcePath: 'src/payment.spec.ts', startLine: 6, endLine: 6 },
    ]);
    expect(result.edges.some(e => e.to.includes('OtherService.refund'))).toBe(false);
  });

  it('does not load a dependency excluded from the selected file set', async () => {
    source('src/excluded.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './excluded.service';
it('refund', () => new PaymentService().refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [test] });
    const result = buildGraph(scan);
    expect(result.edges).toEqual([]);
    expect(result.diagnostics?.some(d => d.code === 'TEST_TARGET_UNRESOLVED')).toBe(true);
    const adapter = await new TypeScriptNestJsAdapter().scan({ rootDir: root, tsFiles: [test] });
    expect(adapter.dependencyEdges).toEqual([]);
    expect(adapter.diagnostics.some(d => d.code === 'TEST_TARGET_UNRESOLVED')).toBe(true);
  });

  it('bounds repeated source locations and reports omitted locations', () => {
    const service = source('src/payment.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './payment.service';
const service = new PaymentService();
it('repeated calls', () => {
${Array.from({ length: 25 }, () => 'service.refund();').join('\n')}
});`);
    const edges = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test] })).edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].provenance?.locations).toHaveLength(20);
    expect(edges[0].provenance?.omittedLocationCount).toBe(5);
  });

  it('resolves default imports without loading additional source files', () => {
    const service = source('src/payment.service.ts', payment.replace('export class', 'export default class'));
    const test = source('src/payment.spec.ts', `import Subject from './payment.service';
it('refund', () => new Subject().refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [service, test] });
    const target = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
    expect(buildGraph(scan).edges).toEqual([expect.objectContaining({ type: 'TESTS', to: target.stableId })]);
  });

  it('resolves inherited path aliases, re-exports, constructor injection, and Nest testing assignments', () => {
    source('tsconfig.base.json', JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '~services/*': ['src/services/*'] },
    } }));
    source('tsconfig.json', JSON.stringify({ extends: './tsconfig.base.json' }));
    const service = source('src/services/payment.service.ts', payment);
    source('src/services/index.ts', "export { PaymentService as Service } from './payment.service';");
    const controller = source('src/controllers/payment.controller.ts', `import { Injectable } from '@nestjs/common';
import { Service as PaymentService } from '~services/index';
@Injectable() export class PaymentController {
  private payments!: PaymentService;
  constructor(payments: PaymentService) { this.payments = payments; }
  refund() { return this.payments.refund(); }
}`);
    const test = source('test/payment.spec.ts', `import { Test } from '@nestjs/testing';
import { Service as PaymentService } from '~services/index';
let service: PaymentService;
let constructed: PaymentService;
beforeEach(async () => {
  const module = await Test.createTestingModule({ providers: [PaymentService] })
    .useMocker(() => undefined).compile();
  service = module.get<PaymentService>(PaymentService);
  constructed = new PaymentService();
});
it.each([1, 2])('refunds %s', () => service.refund());
it('uses a setup constructor assignment', () => constructed.refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [service, controller, test,
      join(root, 'src/services/index.ts')] });
    const graph = buildGraph(scan);
    expect(buildGraph(scan)).toEqual(graph);
    const target = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
    const testCase = scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
    const constructedCase = scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE' &&
      artifact.testCase?.title === 'uses a setup constructor assignment')!;
    const caller = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentController.refund')!;
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'TESTS', from: testCase.stableId, to: target.stableId,
        provenance: expect.objectContaining({ locations: [expect.objectContaining({ sourcePath: 'test/payment.spec.ts' })] }) }),
      expect.objectContaining({ type: 'TESTS', from: constructedCase.stableId, to: target.stableId }),
      expect.objectContaining({ type: 'CALLS', from: caller.stableId, to: target.stableId }),
    ]));
    expect(graph.diagnostics?.some(item => item.reason === 'PATH_ALIAS_RESOLUTION_FAILED')).toBe(false);
  });

  it('reports excluded alias targets and alias failures without creating edges', () => {
    source('tsconfig.json', JSON.stringify({ compilerOptions: {
      baseUrl: '.', paths: { '~services/*': ['src/services/*'], '~missing/*': ['src/missing/*'] },
    } }));
    source('src/services/excluded.ts', payment);
    const test = source('test/alias.spec.ts', `import { PaymentService } from '~services/excluded';
import { MissingService } from '~missing/service';
it('excluded', () => new PaymentService().refund());
it('missing', () => new MissingService().refund());`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [test] }));
    expect(graph.edges).toEqual([]);
    expect(graph.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TEST_TARGET_UNRESOLVED', reason: 'OUT_OF_SCOPE_TARGET',
        sampleEvidence: [expect.objectContaining({ sourcePath: 'test/alias.spec.ts', targetExpression: '~services/excluded' })] }),
      expect.objectContaining({ code: 'TEST_TARGET_UNRESOLVED', reason: 'PATH_ALIAS_RESOLUTION_FAILED' }),
    ]));
  });

  it('keeps ambiguous re-export targets unresolved and marks nested test callbacks unsupported', () => {
    const first = source('src/a.ts', `import { Injectable } from '@nestjs/common';
@Injectable() export class Clash { run() {} }`);
    const second = source('src/b.ts', `import { Injectable } from '@nestjs/common';
@Injectable() export class Clash { run() {} }`);
    const barrel = source('src/index.ts', "export { Clash } from './a';\nexport { Clash } from './b';");
    const test = source('test/ambiguous.spec.ts', `import { Clash } from '../src/index';
it('ambiguous', () => new Clash().run());
it('nested', () => { setTimeout(() => new Clash().run(), 0); });`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [first, second, barrel, test] }));
    expect(graph.edges.filter(edge => edge.type === 'TESTS')).toEqual([]);
    expect(graph.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'AMBIGUOUS_SYMBOL' }),
      expect.objectContaining({ reason: 'UNSUPPORTED_NESTED_CALLBACK' }),
    ]));
  });

  it('resolves cyclic star re-exports independently of the first import path', () => {
    const first = source('src/a.ts', "export * from './b'; export * from './c';");
    const second = source('src/b.ts', "export * from './a';");
    const service = source('src/c.ts', payment);
    const cases = [
      "it('through a', () => new ThroughA().refund());",
      "it('through b', () => new ThroughB().refund());",
    ];
    for (const orderedCases of [cases, [...cases].reverse()]) {
      const test = source('test/cycle.spec.ts', `import { PaymentService as ThroughA } from '../src/a';
import { PaymentService as ThroughB } from '../src/b';
${orderedCases.join('\n')}`);
      const scan = scanProject({ fixturePath: root, tsFiles: [first, second, service, test] });
      const target = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
      const graph = buildGraph(scan);
      expect(graph.edges.filter(edge => edge.type === 'TESTS').map(edge => edge.to)).toEqual([
        target.stableId, target.stableId,
      ]);
      expect(graph.diagnostics?.some(item => item.code === 'TEST_TARGET_UNRESOLVED')).toBe(false);
    }
  });

  it('visits shared re-export branches once per lookup', () => {
    const files = [source('src/payment.service.ts', payment)];
    for (let level = 12; level >= 0; level--) {
      const exports = level === 12 ? "export * from './payment.service';" :
        `export * from './level-${level + 1}-left';
export * from './level-${level + 1}-right';`;
      files.push(source(`src/level-${level}-left.ts`, exports));
      files.push(source(`src/level-${level}-right.ts`, exports));
    }
    const test = source('test/branch.spec.ts', `import { PaymentService } from '../src/level-0-left';
it('refund', () => new PaymentService().refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [...files, test] });
    const moduleResolution = jest.spyOn(ScannedModuleResolver.prototype, 'resolve');
    try {
      const graph = buildGraph(scan);
      expect(graph.edges.filter(edge => edge.type === 'TESTS')).toHaveLength(1);
      expect(moduleResolution.mock.calls.length).toBeLessThan(100);
    } finally {
      moduleResolution.mockRestore();
    }
  });

  it('reports a bounded unresolved target for deep re-export chains', () => {
    const files = [source('src/payment.service.ts', payment)];
    for (let index = 0; index < 260; index++) {
      const target = index === 259 ? 'payment.service' : `chain-${index + 1}`;
      files.push(source(`src/chain-${index}.ts`, `export * from './${target}';`));
    }
    const test = source('test/deep.spec.ts', `import { PaymentService } from '../src/chain-0';
it('refund', () => new PaymentService().refund());`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [...files, test] }));
    expect(graph.edges.filter(edge => edge.type === 'TESTS')).toEqual([]);
    expect(graph.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TEST_TARGET_UNRESOLVED', reason: 'EXPORT_RESOLUTION_LIMIT_EXCEEDED' }),
    ]));
  });

  it('skips unrelated named re-exports before module resolution', () => {
    const service = source('src/payment.service.ts', payment);
    const barrel = source('src/index.ts', `export { Missing } from './missing';
export { PaymentService } from './payment.service';`);
    const test = source('test/named.spec.ts', `import { PaymentService } from '../src/index';
it('refund', () => new PaymentService().refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [service, barrel, test] });
    const moduleResolution = jest.spyOn(ScannedModuleResolver.prototype, 'resolve');
    try {
      expect(buildGraph(scan).edges.filter(edge => edge.type === 'TESTS')).toHaveLength(1);
      expect(moduleResolution.mock.calls.map(call => call[0])).not.toContain('./missing');
    } finally {
      moduleResolution.mockRestore();
    }
  });

  it('links direct calls declared in Jest throw assertion callbacks only', () => {
    const service = source('src/payment.service.ts', payment);
    const test = source('test/throw-assertions.spec.ts', `import { PaymentService } from '../src/payment.service';
const service = new PaymentService();
it('inline throw callback', () => expect(() => service.refund()).toThrowError());
it('named throw callback', () => {
  const action = () => service.authorize();
  expect(action).not.toThrow();
});
it('callback nested in timer remains unresolved', () =>
  expect(() => setTimeout(() => service.refund(), 0)).toThrow());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [service, test] });
    const graph = buildGraph(scan);
    const target = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
    const authorize = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.authorize')!;
    const inline = scan.artifacts.find(artifact => artifact.testCase?.title === 'inline throw callback')!;
    const named = scan.artifacts.find(artifact => artifact.testCase?.title === 'named throw callback')!;
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'TESTS', from: inline.stableId, to: target.stableId }),
      expect.objectContaining({ type: 'TESTS', from: named.stableId, to: authorize.stableId }),
    ]));
    expect(graph.edges.filter(edge => edge.type === 'TESTS')).toHaveLength(2);
    expect(graph.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'UNSUPPORTED_NESTED_CALLBACK' }),
    ]));
  });

  it('does not treat namespace re-exports as named class exports', () => {
    const service = source('src/payment.service.ts', payment);
    const barrel = source('src/index.ts', "export * as PaymentService from './payment.service';");
    const test = source('test/namespace.spec.ts', `import { PaymentService } from '../src/index';
it('unsupported namespace import', () => new PaymentService().refund());`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, barrel, test] }));
    expect(graph.edges.filter(edge => edge.type === 'TESTS')).toEqual([]);
    expect(graph.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'UNSUPPORTED_NAMESPACE_REEXPORT' }),
    ]));
  });

  it('does not resolve reassigned instances or this inside an ordinary nested function', () => {
    const service = source('src/payment.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './payment.service';
let service = new PaymentService();
service = { refund() {} } as any;
it('mock', () => service.refund());`);
    const booking = source('src/booking.service.ts', `import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment.service';
@Injectable() export class BookingService {
  constructor(private payment: PaymentService) {}
  cancel() { return function() { this.payment.refund(); }; }
}`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test, booking] }));
    expect(graph.edges).toEqual([]);
    expect(graph.diagnostics?.some(d => d.code === 'UNRESOLVED_RECEIVER_SCOPE')).toBe(true);
  });

  it('resolves lexical this calls inside arrow callbacks while leaving execution unclaimed', () => {
    const service = source('src/payment.service.ts', payment);
    const booking = source('src/booking.service.ts', `import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment.service';
@Injectable() export class BookingService {
  constructor(private payment: PaymentService) {}
  cancel() { return [1].map(() => this.payment.refund()); }
}`);
    const scan = scanProject({ fixturePath: root, tsFiles: [service, booking] });
    const graph = buildGraph(scan);
    const caller = scan.artifacts.find(artifact => artifact.symbolName === 'BookingService.cancel')!;
    const target = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
    expect(graph.edges).toEqual([expect.objectContaining({ type: 'CALLS', from: caller.stableId, to: target.stableId,
      provenance: expect.objectContaining({ resolver: 'TS_AST_DIRECT_CALL', locations: [
        { sourcePath: 'src/booking.service.ts', startLine: 5, endLine: 5 },
      ] }) })]);
  });

  it('resolves duplicate class and method names by canonical repository path', () => {
    const first = source('src/a/payment.service.ts', payment);
    const second = source('src/b/payment.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './a/payment.service';
it('refund', () => new PaymentService().refund());`);
    const scan = scanProject({ fixturePath: root, tsFiles: [first, second, test] });
    const methods = scan.artifacts.filter(artifact => artifact.symbolName === 'PaymentService.refund');
    expect(methods).toHaveLength(2);
    expect(new Set(methods.map(artifact => artifact.stableId)).size).toBe(2);
    expect(methods.every(artifact => artifact.stableId.includes(encodeURIComponent(artifact.filePath)))).toBe(true);
    const graph = buildGraph(scan);
    expect(graph.edges.filter(edge => edge.type === 'TESTS').map(edge => edge.to)).toEqual([methods[0].stableId]);
    expect(graph.diagnostics?.some(d => d.code === 'AMBIGUOUS_ARTIFACT_IDENTITY')).toBe(false);
  });

  it('does not choose the first duplicate imported class and reports unresolved test targets', () => {
    const duplicate = source('src/payment.service.ts', `import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentService { refund() {} }
@Injectable() export class PaymentService { refund() {} }`);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './payment.service';
it('refund', () => new PaymentService().refund());`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [duplicate, test] }));
    expect(graph.edges.filter(edge => edge.type === 'TESTS')).toEqual([]);
    expect(graph.diagnostics?.some(d => d.code === 'AMBIGUOUS_SYMBOL_RESOLUTION')).toBe(true);
    expect(graph.diagnostics?.some(d => d.code === 'TEST_TARGET_UNRESOLVED')).toBe(true);
  });

  it('retains both directions of a source cycle exactly once', () => {
    const cyclic = source('src/cycle.service.ts', `import { Injectable } from '@nestjs/common';
@Injectable() export class CycleService {
  first() { return this.second(); }
  second() { return this.first(); }
}`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [cyclic] }));
    expect(graph.edges.map(edge => [edge.from, edge.type, edge.to])).toEqual([
      [expect.stringContaining('CycleService.first'), 'CALLS', expect.stringContaining('CycleService.second')],
      [expect.stringContaining('CycleService.second'), 'CALLS', expect.stringContaining('CycleService.first')],
    ]);
  });
});
