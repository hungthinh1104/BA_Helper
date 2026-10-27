export type FixtureFiles = Readonly<Record<string, string>>;
export type SourceLocation = { sourcePath: string; startLine: number; endLine: number };
export type Endpoint = {
  filePath: string;
  symbolName?: string;
  test?: { suitePath: string[]; title: string };
};
export type ExpectedRelationship = {
  type: 'CALLS' | 'TESTS';
  from: Endpoint;
  to: Endpoint;
  locations: SourceLocation[];
};
export type ExpectedDiagnostic = {
  code: string;
  reason: string;
  filePath: string;
  startLine: number;
};
export type AdversarialCase = {
  id: string;
  risk: string;
  transformation: string;
  rationale: string;
  outcome: 'PRESERVE' | 'REMOVE' | 'REMAP' | 'UNRESOLVED';
  baseline: FixtureFiles;
  transform: (baseline: FixtureFiles) => FixtureFiles;
  expectedBaseline: ExpectedRelationship[];
  expectedTransformed: ExpectedRelationship[];
  expectedBaselineDiagnostics: ExpectedDiagnostic[];
  expectedTransformedDiagnostics: ExpectedDiagnostic[];
};

const paymentSource = `import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentService {
  authorize() {}
  refund() {}
}`;

function testSource(expression: string, title = 'calls refund'): string {
  return `import { PaymentService } from './payment.service';\nit('${title}', () => ${expression});\n`;
}

function paymentFixture(test: string): FixtureFiles {
  return { 'src/payment.service.ts': paymentSource, 'src/payment.spec.ts': test };
}

function replaceOnce(source: string, before: string, after: string): string {
  const index = source.indexOf(before);
  if (index < 0 || source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected one transformation anchor: ${before}`);
  }
  return `${source.slice(0, index)}${after}${source.slice(index + before.length)}`;
}

const testEndpoint = (title = 'calls refund'): Endpoint => ({
  filePath: 'src/payment.spec.ts', test: { suitePath: [], title },
});

const testRelationship = (targetPath: string, targetSymbol: string, line: number,
  title = 'calls refund'): ExpectedRelationship => ({
  type: 'TESTS', from: testEndpoint(title),
  to: { filePath: targetPath, symbolName: targetSymbol },
  locations: [{ sourcePath: 'src/payment.spec.ts', startLine: line, endLine: line }],
});

const refundAtLineTwo = testRelationship('src/payment.service.ts', 'PaymentService.refund', 2);

export const adversarialCases: readonly AdversarialCase[] = [
  {
    id: 'AE-IDENTITY-SAME-METHOD-01', risk: 'same method name across production files',
    transformation: 'Add an unrelated RefundService.refund beside the imported PaymentService.refund target.',
    rationale: 'The test imports PaymentService from one canonical file; an unreferenced method with the same name in another file is not its target.',
    outcome: 'PRESERVE', baseline: paymentFixture(testSource('new PaymentService().refund()')),
    transform: files => ({ ...files, 'src/refund.service.ts': paymentSource.replace('PaymentService', 'RefundService') }),
    expectedBaseline: [refundAtLineTwo], expectedTransformed: [refundAtLineTwo],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-IDENTITY-ALIAS-01', risk: 'imported target identity',
    transformation: 'Rename the imported class locally and update its constructor use.',
    rationale: 'A local import alias changes spelling, not the imported declaration or invoked method.',
    outcome: 'PRESERVE', baseline: paymentFixture(testSource('new PaymentService().refund()')),
    transform: files => ({ ...files, 'src/payment.spec.ts': replaceOnce(
      replaceOnce(files['src/payment.spec.ts'], 'PaymentService }', 'PaymentService as RefundSubject }'),
      'new PaymentService()', 'new RefundSubject()') }),
    expectedBaseline: [refundAtLineTwo], expectedTransformed: [refundAtLineTwo],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-IDENTITY-SUBSTITUTE-01', risk: 'stale or wrong direct target',
    transformation: 'Replace the direct refund invocation with authorize on the same declared service.',
    rationale: 'The transformed AST calls a different declared method; the former target is no longer referenced.',
    outcome: 'REMOVE', baseline: paymentFixture(testSource('new PaymentService().refund()')),
    transform: files => ({ ...files, 'src/payment.spec.ts': replaceOnce(
      files['src/payment.spec.ts'], '.refund()', '.authorize()') }),
    expectedBaseline: [refundAtLineTwo],
    expectedTransformed: [testRelationship('src/payment.service.ts', 'PaymentService.authorize', 2)],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-NEGATIVE-IMPORT-01', risk: 'import mistaken for invocation',
    transformation: 'Retain the import but remove the method call from the test body.',
    rationale: 'An import or constructed instance does not declare a direct method reference in the test body.',
    outcome: 'REMOVE', baseline: paymentFixture(testSource('new PaymentService().refund()')),
    transform: files => ({ ...files, 'src/payment.spec.ts': [
      "import { PaymentService } from './payment.service';",
      "it('calls refund', () => {",
      '  const service = new PaymentService();',
      '  expect(service).toBeDefined();',
      '});',
      '',
    ].join('\n') }),
    expectedBaseline: [refundAtLineTwo], expectedTransformed: [],
    expectedBaselineDiagnostics: [],
    expectedTransformedDiagnostics: [{ code: 'TEST_TARGET_UNRESOLVED',
      reason: 'NO_SUPPORTED_DIRECT_REFERENCE', filePath: 'src/payment.spec.ts', startLine: 2 }],
  },
  {
    id: 'AE-PROVENANCE-SHIFT-01', risk: 'stale graph source line',
    transformation: 'Insert a comment and blank line before the unchanged direct invocation.',
    rationale: 'A harmless prefix shift changes source coordinates but preserves the same call and target.',
    outcome: 'REMAP', baseline: paymentFixture([
      "import { PaymentService } from './payment.service';",
      "it('calls refund', () => {",
      '  const service = new PaymentService();',
      '  service.refund();',
      '});',
      '',
    ].join('\n')),
    transform: files => ({ ...files, 'src/payment.spec.ts': replaceOnce(
      files['src/payment.spec.ts'], '  service.refund();', '  // inserted without changing behavior\n\n  service.refund();') }),
    expectedBaseline: [testRelationship('src/payment.service.ts', 'PaymentService.refund', 4)],
    expectedTransformed: [testRelationship('src/payment.service.ts', 'PaymentService.refund', 6)],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-PROVENANCE-NESTED-01', risk: 'nested call source selection',
    transformation: 'Move the supported invocation from a variable initializer into a multiline assertion argument.',
    rationale: 'The inner production call remains the target; provenance must identify its line rather than the outer assertion call.',
    outcome: 'REMAP', baseline: paymentFixture([
      "import { PaymentService } from './payment.service';",
      "it('calls refund', () => {",
      '  const service = new PaymentService();',
      '  const result = service.refund();',
      '  expect(result).toBeDefined();',
      '});',
      '',
    ].join('\n')),
    transform: files => ({ ...files, 'src/payment.spec.ts': replaceOnce(files['src/payment.spec.ts'],
      '  const result = service.refund();\n  expect(result).toBeDefined();',
      '  expect(\n    service.refund(),\n  ).toBeDefined();') }),
    expectedBaseline: [testRelationship('src/payment.service.ts', 'PaymentService.refund', 4)],
    expectedTransformed: [testRelationship('src/payment.service.ts', 'PaymentService.refund', 5)],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-IDENTITY-MOVE-01', risk: 'stale canonical path identity',
    transformation: 'Move the production file and update its relative import without changing class or method.',
    rationale: 'The same class/method now resolves from a different canonical repository path.',
    outcome: 'REMAP', baseline: paymentFixture(testSource('new PaymentService().refund()')),
    transform: files => {
      const movedTest = replaceOnce(files['src/payment.spec.ts'], './payment.service', './payment/refund.service');
      return {
        'src/payment/refund.service.ts': files['src/payment.service.ts'],
        'src/payment.spec.ts': movedTest,
      };
    },
    expectedBaseline: [refundAtLineTwo],
    expectedTransformed: [testRelationship('src/payment/refund.service.ts', 'PaymentService.refund', 2)],
    expectedBaselineDiagnostics: [], expectedTransformedDiagnostics: [],
  },
  {
    id: 'AE-UNRESOLVED-TEST-DYNAMIC-01', risk: 'computed Jest target',
    transformation: 'Replace a direct test call with service[methodName](), where methodName comes from the environment.',
    rationale: 'The source does not establish one method declaration, so a direct TESTS edge would be fabricated.',
    outcome: 'UNRESOLVED', baseline: paymentFixture([
      "import { PaymentService } from './payment.service';",
      "it('calls refund', () => {",
      '  const service = new PaymentService();',
      '  service.refund();',
      '});',
      '',
    ].join('\n')),
    transform: files => ({ ...files, 'src/payment.spec.ts': [
      "import { PaymentService } from './payment.service';",
      "const methodName: string = process.env.PAYMENT_METHOD ?? 'refund';",
      "it('calls refund', () => {",
      '  const service = new PaymentService();',
      '  service[methodName]();',
      '});',
      '',
    ].join('\n') }),
    expectedBaseline: [testRelationship('src/payment.service.ts', 'PaymentService.refund', 4)],
    expectedTransformed: [], expectedBaselineDiagnostics: [],
    expectedTransformedDiagnostics: [{ code: 'TEST_TARGET_UNRESOLVED', reason: 'DYNAMIC_METHOD_REFERENCE',
      filePath: 'src/payment.spec.ts', startLine: 5 }],
  },
  {
    id: 'AE-UNRESOLVED-CALL-DYNAMIC-01', risk: 'computed production target',
    transformation: 'Replace this.payment.refund() with this.payment[methodName]() for a method parameter.',
    rationale: 'The receiver class is known, but the computed key does not identify a unique target method.',
    outcome: 'UNRESOLVED', baseline: {
      'src/payment.service.ts': paymentSource,
      'src/booking.service.ts': [
        "import { Injectable } from '@nestjs/common';",
        "import { PaymentService } from './payment.service';",
        '',
        '@Injectable() export class BookingService {',
        '  constructor(private readonly payment: PaymentService) {}',
        '  cancel(methodName: string) { this.payment.refund(); }',
        '}',
        '',
      ].join('\n'),
    },
    transform: files => ({ ...files, 'src/booking.service.ts': replaceOnce(
      files['src/booking.service.ts'], 'this.payment.refund()', 'this.payment[methodName]()') }),
    expectedBaseline: [{ type: 'CALLS',
      from: { filePath: 'src/booking.service.ts', symbolName: 'BookingService.cancel' },
      to: { filePath: 'src/payment.service.ts', symbolName: 'PaymentService.refund' },
      locations: [{ sourcePath: 'src/booking.service.ts', startLine: 6, endLine: 6 }] }],
    expectedTransformed: [], expectedBaselineDiagnostics: [],
    expectedTransformedDiagnostics: [{ code: 'UNRESOLVED_METHOD_TARGET', reason: 'DYNAMIC_METHOD_REFERENCE',
      filePath: 'src/booking.service.ts', startLine: 6 }],
  },
  {
    id: 'AE-UNRESOLVED-INJECTION-DECOY-01', risk: 'unresolved dependency injection and same-name decoy',
    transformation: 'Add an unrelated same-named service while the imported injection target remains missing.',
    rationale: 'A matching class name outside the unresolved import path does not establish receiver identity.',
    outcome: 'UNRESOLVED', baseline: {
      'src/booking.service.ts': [
        "import { Injectable } from '@nestjs/common';",
        "import { PaymentService } from './missing/payment.service';",
        '',
        '@Injectable() export class BookingService {',
        '  constructor(private readonly payment: PaymentService) {}',
        '  cancel() { this.payment.refund(); }',
        '}',
        '',
      ].join('\n'),
    },
    transform: files => ({ ...files, 'src/decoy/payment.service.ts': paymentSource }),
    expectedBaseline: [], expectedTransformed: [],
    expectedBaselineDiagnostics: [{ code: 'UNRESOLVED_INJECTION_TOKEN', reason: 'IMPORT_RESOLUTION_FAILED',
      filePath: 'src/booking.service.ts', startLine: 6 }],
    expectedTransformedDiagnostics: [{ code: 'UNRESOLVED_INJECTION_TOKEN', reason: 'IMPORT_RESOLUTION_FAILED',
      filePath: 'src/booking.service.ts', startLine: 6 }],
  },
];
