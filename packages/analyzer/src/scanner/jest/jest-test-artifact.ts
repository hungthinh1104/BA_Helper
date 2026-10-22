import { createHash } from 'node:crypto';
import type { CallExpression } from 'ts-morph';
import type { ScanArtifact, ScanStaticBehaviorClaim, TestModifier } from '../scanner.types';
import { SecretRedactor } from '../core/secret-redactor';
import { computeArtifactContentHash } from '../core/content-hasher';

export function createJestTestArtifact(input: {
  call: CallExpression; parent: ScanArtifact; title: string; suitePath: string[];
  modifier: TestModifier; declaredModifier: TestModifier;
  behaviorEvidence?: ScanStaticBehaviorClaim[];
  parameterized?: boolean;
  bodySpan?: { start: number; end: number };
}): ScanArtifact {
  const { call, parent, title, suitePath, modifier, declaredModifier } = input;
  const identity = createHash('sha256').update(JSON.stringify([
    suitePath, title, ...(input.parameterized ? ['PARAMETERIZED'] : []),
  ])).digest('hex');
  const safeTitle = SecretRedactor.redact(title).redactedContent;
  const safeSuites = suitePath.map(suite => SecretRedactor.redact(suite).redactedContent);
  const excerpt = call.getText();
  const behaviorFingerprint = input.behaviorEvidence?.length
    ? JSON.stringify(input.behaviorEvidence.map(claim => [claim.kind, claim.assertionKind ?? null, claim.sourceText])) : '';
  const contentSource = behaviorFingerprint
    ? `${excerpt}\n${modifier}\n${behaviorFingerprint}` : `${excerpt}\n${modifier}`;
  return {
    stableId: `test-case:${parent.filePath}::${identity}`,
    type: 'JEST_TEST_CASE', filePath: parent.filePath,
    symbolName: [...safeSuites, safeTitle].join(' > '),
    startLine: call.getStartLineNumber(), endLine: call.getEndLineNumber(), excerpt,
    contentHash: computeArtifactContentHash(contentSource),
    testCase: { framework: 'jest', suitePath: safeSuites, title: safeTitle, modifier,
      declaredModifier, parentFileArtifactKey: parent.stableId,
      ...(input.parameterized ? { parameterized: true } : {}),
      ...(input.behaviorEvidence?.length ? { behaviorEvidence: input.behaviorEvidence } : {}) },
    ...(input.bodySpan ? { testBodySpan: input.bodySpan } : {}),
  };
}
