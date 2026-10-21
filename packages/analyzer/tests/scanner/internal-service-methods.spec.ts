import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { ANALYZER_VERSION, buildGraph, scanFixture, scanProject } from '../../src';

describe('internal service source artifacts', () => {
  let root: string;
  beforeEach(() => {
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-internal-method-')));
    mkdirSync(join(root, 'src'));
  });
  afterEach(() => {
    const name = relative(realpathSync.native(tmpdir()), root);
    if (!name.startsWith('ba-internal-method-') || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['selected files', 'legacy fixture'] as const)('keeps private/protected helpers and their calls via %s', mode => {
    const file = join(root, 'src/payment.service.ts');
    writeFileSync(file, `import { Injectable } from '@nestjs/common';
      @Injectable() export class PaymentService {
        refund() { return this.validate(); }
        private validate() { return this.checkPolicy(); }
        protected checkPolicy() { return true; }
      }
      class Unrelated { private hidden() {} }`);
    const scan = mode === 'selected files' ? scanProject({ fixturePath: root, tsFiles: [file] }) : scanFixture({ fixturePath: root });
    expect(scan.analyzerVersion).toBe(ANALYZER_VERSION);
    expect(scan.artifacts.map(a => [a.type, a.symbolName])).toEqual([
      ['SERVICE_METHOD', 'PaymentService.refund'], ['SERVICE_METHOD', 'PaymentService.validate'],
      ['SERVICE_METHOD', 'PaymentService.checkPolicy'],
    ]);
    const graph = buildGraph(scan);
    expect(graph.edges.map(e => [e.from, e.type, e.to])).toEqual([
      ['service-method:payment.service.refund', 'CALLS', 'service-method:payment.service.validate'],
      ['service-method:payment.service.validate', 'CALLS', 'service-method:payment.service.checkPolicy'],
    ]);
    expect(graph.edges.every(e => e.provenance?.locations[0].sourcePath === 'src/payment.service.ts')).toBe(true);
  });

  it('does not label private controller helpers as HTTP endpoints', () => {
    const file = join(root, 'src/payment.controller.ts');
    writeFileSync(file, `import { Controller, Get } from '@nestjs/common';
      @Controller() export class PaymentController {
        @Get() refund() { return this.hidden(); }
        private hidden() { return true; }
      }`);
    const scan = scanProject({ fixturePath: root, tsFiles: [file] });
    expect(scan.artifacts.map(a => a.symbolName)).toEqual(['PaymentController.refund']);
    expect(buildGraph(scan).edges).toEqual([]);
  });
});
