import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateSaasEntry } from '../tests/release/controlled-beta-readiness';

async function main(): Promise<void> {
  const inputArgument = process.argv.slice(2).find((value) => value !== '--');
  if (!inputArgument) {
    throw new Error(
      'Usage: pnpm verify:saas-entry -- artifacts/product-validation/comparison.json',
    );
  }

  const root = process.cwd();
  const comparison = JSON.parse(
    await readFile(path.resolve(root, inputArgument), 'utf8'),
  ) as unknown;
  const result = evaluateSaasEntry(comparison);
  const outputDirectory = path.join(root, 'artifacts/release');
  const outputPath = path.join(outputDirectory, 'saas-entry.json');

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Phase 5 SaaS entry: ${result.status}`);
  console.log(`Artifact: ${path.relative(root, outputPath)}`);

  if (result.status === 'LOCKED') {
    result.reasons.forEach((reason) => console.error(`- ${reason}`));
    process.exitCode = 2;
  }
}

void main();

