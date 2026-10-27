import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { buildDeveloperStudyScorecard } from '../tests/evaluation/developer-comprehension/developer-study.scorecard';

async function run(): Promise<void> {
  const inputArgument = process.argv.slice(2).find((argument) => argument !== '--' && !argument.startsWith('-'));
  if (!inputArgument) {
    throw new Error('Usage: pnpm validate:developer-study -- <dataset-path>');
  }

  const inputPath = resolve(process.cwd(), inputArgument);
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  const scorecard = buildDeveloperStudyScorecard(input);
  const outputPath = resolve(process.cwd(), 'artifacts/evaluation/developer-comprehension-study-scorecard.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(scorecard, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({
    outputPath: relative(process.cwd(), outputPath),
    studyStatus: scorecard.studyStatus,
    collectionStatus: scorecard.collectionStatus,
    observationCount: scorecard.observationCount,
  }, null, 2) + '\n');
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Study dataset validation failed.';
  process.stderr.write(message + '\n');
  process.exitCode = 2;
});
