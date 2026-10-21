import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildGraph, SafeFileEnumerator, scanProject } from '../../src';
import { TypeScriptNestJsAdapter } from '../../src/scanner/adapters/typescript-nestjs.adapter';

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
    expect(triples).toEqual(expect.arrayContaining([
      'api:booking.controller.cancel|CALLS|service-method:booking.service.cancelBooking',
      'service-method:booking.service.cancelBooking|CALLS|service-method:payment.service.refund',
      `${test.stableId}|TESTS|service-method:booking.service.cancelBooking`,
    ]));
    expect(result.dependencyEdges.every(e => e.confidence === 1 && e.provenance?.locations.length)).toBe(true);
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
    const refund = result.edges.find(e => e.type === 'TESTS' && e.to.includes('payment.service.refund'));
    expect(refund?.provenance?.locations).toEqual([
      { sourcePath: 'src/payment.spec.ts', startLine: 5, endLine: 5 },
      { sourcePath: 'src/payment.spec.ts', startLine: 6, endLine: 6 },
    ]);
    expect(result.edges.some(e => e.to.includes('other.service.refund'))).toBe(false);
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
    const edges = buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test] })).edges;
    expect(edges).toEqual([expect.objectContaining({ type: 'TESTS', to: 'service-method:payment.service.refund' })]);
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

  it('does not publish relationships whose artifact identities collide', () => {
    const first = source('src/a/payment.service.ts', payment);
    const second = source('src/b/payment.service.ts', payment);
    const test = source('src/payment.spec.ts', `import { PaymentService } from './a/payment.service';
it('refund', () => new PaymentService().refund());`);
    const graph = buildGraph(scanProject({ fixturePath: root, tsFiles: [first, second, test] }));
    expect(graph.edges).toEqual([]);
    expect(graph.diagnostics?.some(d => d.code === 'AMBIGUOUS_ARTIFACT_IDENTITY')).toBe(true);
  });
});
