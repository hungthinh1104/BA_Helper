import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildProductValidationScorecard,
  compareProductValidationDatasets,
  findCliInputArguments,
} from '../tests/product-validation/product-validation-scorecard';

async function main(): Promise<void> {
  const [inputArgument, baselineArgument] = findCliInputArguments(
    process.argv.slice(2),
  );
  if (!inputArgument) {
    throw new Error(
      'Usage: pnpm validate:product-beta -- <candidate.json> [baseline.json]',
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

  if (baselineArgument) {
    const baselinePath = path.resolve(root, baselineArgument);
    const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as unknown;
    const comparison = compareProductValidationDatasets(dataset, baseline);
    const comparisonPath = path.join(outputDirectory, 'comparison.json');

    await writeFile(
      comparisonPath,
      `${JSON.stringify(comparison, null, 2)}\n`,
    );
    console.log(`Product decision: ${comparison.decision}`);
    console.log(`Comparison: ${path.relative(root, comparisonPath)}`);

    if (comparison.decision === 'INCONCLUSIVE') {
      process.exitCode = 2;
    } else if (comparison.decision === 'DEFER') {
      process.exitCode = 3;
    }
    return;
  }

  if (scorecard.status === 'INSUFFICIENT_CASES') {
    process.exitCode = 2;
  }
}

void main();
