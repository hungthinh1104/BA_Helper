import { writeFileSync } from 'fs';
import { loadDataset, resolveRepoPath, writeJsonFile } from '../io';
import {
  probeDbSnapshotReadiness,
  renderDbSnapshotReadinessMarkdown,
} from '../src/db-snapshot-readiness';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  const jsonPath = parseArg(
    '--json',
    'evaluation/results/db-snapshot-readiness.v0.json',
  );
  const markdownPath = parseArg(
    '--markdown',
    'evaluation/results/db-snapshot-readiness.v0.md',
  );
  const dataset = loadDataset('evaluation/datasets/cases.v0.json');
  const exampleCaseId = dataset.cases[0]?.id;

  const report = await probeDbSnapshotReadiness();
  writeJsonFile(jsonPath, report);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderDbSnapshotReadinessMarkdown({ report, exampleCaseId }),
    'utf8',
  );

  console.log(`Wrote DB snapshot readiness JSON to ${jsonPath}`);
  console.log(`Wrote DB snapshot readiness markdown to ${markdownPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
