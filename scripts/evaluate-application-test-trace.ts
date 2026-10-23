import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateApplicationTestTraces } from '../tests/evaluation/application-test-trace.evaluator';

const result = { generatedAt: new Date().toISOString(),
  ...evaluateApplicationTestTraces() };
const output = path.resolve('artifacts/evaluation/application-test-trace-scorecard.json');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Application static trace corpus: ${result.status}`);
console.log(`Regression gate: ${result.regression.status}`);
console.log('Scope: selected pinned source slices; this is a corpus regression, not a general accuracy estimate.');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.totals).map(([key, { missing, unexpected, ...score }]) => {
  void missing; void unexpected;
  return [key, score];
})), null, 2));
console.log(`Source evidence integrity: ${result.evidence.supportedRelationships}/${result.evidence.checkedRelationships} (${result.evidence.integrityRate ?? 'n/a'})`);
console.log(`Diagnosed unsupported declarations: ${result.unsupportedPatterns.diagnosedUnsupportedDeclarations}/${result.unsupportedPatterns.observedDeclarations} (${result.unsupportedPatterns.observedRate ?? 'n/a'})`);
console.log(`Artifact: ${path.relative(process.cwd(), output)}`);
if (result.regression.status !== 'PASS') process.exitCode = 1;
