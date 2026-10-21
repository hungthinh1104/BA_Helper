import { createHash } from 'node:crypto';
import type { CallExpression } from 'ts-morph';
import type { ScanArtifact, TestModifier } from '../scanner.types';
import { SecretRedactor } from '../core/secret-redactor';
import { computeArtifactContentHash } from '../core/content-hasher';

export function createJestTestArtifact(input: {
  call: CallExpression; parent: ScanArtifact; title: string; suitePath: string[];
  modifier: TestModifier; declaredModifier: TestModifier;
  bodySpan?: { start: number; end: number };
}): ScanArtifact {
  const { call, parent, title, suitePath, modifier, declaredModifier } = input;
  const identity = createHash('sha256').update(JSON.stringify([suitePath, title])).digest('hex');
  const safeTitle = SecretRedactor.redact(title).redactedContent;
  const safeSuites = suitePath.map(suite => SecretRedactor.redact(suite).redactedContent);
  const excerpt = call.getText();
  return {
    stableId: `test-case:${parent.filePath}::${identity}`,
    type: 'JEST_TEST_CASE', filePath: parent.filePath,
    symbolName: [...safeSuites, safeTitle].join(' > '),
    startLine: call.getStartLineNumber(), endLine: call.getEndLineNumber(), excerpt,
    contentHash: computeArtifactContentHash(`${excerpt}\n${modifier}`),
    testCase: { framework: 'jest', suitePath: safeSuites, title: safeTitle, modifier,
      declaredModifier, parentFileArtifactKey: parent.stableId },
    ...(input.bodySpan ? { testBodySpan: input.bodySpan } : {}),
  };
}
