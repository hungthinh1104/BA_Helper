import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LexicalRetrievalEvaluationAdapter } from '../tests/evaluation/adapters/lexical-retrieval.adapter';
import { bookingStableEvaluationCases } from '../tests/evaluation/cases';
import {
  runStableQualityGate,
  type QualityBaseline,
} from '../tests/evaluation/stable-quality-gate';

async function main(): Promise<void> {
  const root = process.cwd();
  const baseline = JSON.parse(
    await readFile(
      path.join(root, 'tests/evaluation/quality-baseline.json'),
      'utf8',
    ),
  ) as QualityBaseline;
  const scorecard = await runStableQualityGate({
    adapter: new LexicalRetrievalEvaluationAdapter(),
    cases: bookingStableEvaluationCases,
    baseline,
  });
  const outputDirectory = path.join(root, 'artifacts/evaluation');
  const outputPath = path.join(outputDirectory, 'analyzer-scorecard.json');

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(scorecard, null, 2)}\n`);

  console.log(
    `Analyzer quality gate: ${scorecard.status} (${scorecard.caseCount} cases)`,
  );
  console.log(`Scorecard: ${path.relative(root, outputPath)}`);
  console.log(JSON.stringify(scorecard.metrics));

  if (scorecard.status === 'FAIL') {
    for (const failure of scorecard.failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

void main();
