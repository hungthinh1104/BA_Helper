import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluatePublicTestTraces } from '../tests/evaluation/public-test-trace.evaluator';

const result = { generatedAt: new Date().toISOString(), ...evaluatePublicTestTraces() };
const output = path.resolve('artifacts/evaluation/public-test-trace-scorecard.json');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Public static trace corpus: ${result.status}`);
console.log(JSON.stringify(result.totals, null, 2));
console.log(`Source evidence integrity: ${result.evidence.supportedRelationships}/${result.evidence.checkedRelationships} (${result.evidence.integrityRate ?? 'n/a'})`);
console.log(`Diagnosed unsupported declarations: ${result.unsupportedPatterns.diagnosedUnsupportedDeclarations}/${result.unsupportedPatterns.observedDeclarations} (${result.unsupportedPatterns.observedRate ?? 'n/a'})`);
console.log(`Artifact: ${path.relative(process.cwd(), output)}`);
if (result.status !== 'PASS') process.exitCode = 1;
