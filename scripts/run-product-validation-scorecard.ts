import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildProductValidationScorecard,
  findCliInputArgument,
} from '../tests/product-validation/product-validation-scorecard';

async function main(): Promise<void> {
  const inputArgument = findCliInputArgument(process.argv.slice(2));
  if (!inputArgument) {
    throw new Error(
      'Usage: pnpm validate:product-beta -- <product-validation-dataset.json>',
    );
  }

  const root = process.cwd();
  const inputPath = path.resolve(root, inputArgument);
  const dataset = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  const scorecard = buildProductValidationScorecard(dataset);
  const outputDirectory = path.join(root, 'artifacts/product-validation');
  const outputPath = path.join(outputDirectory, 'scorecard.json');

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(scorecard, null, 2)}\n`);

  console.log(
    `Product validation: ${scorecard.status} (${scorecard.caseCount} cases)`,
  );
  console.log(`Scorecard: ${path.relative(root, outputPath)}`);

  if (scorecard.status === 'INSUFFICIENT_CASES') {
    process.exitCode = 2;
  }
}

void main();
