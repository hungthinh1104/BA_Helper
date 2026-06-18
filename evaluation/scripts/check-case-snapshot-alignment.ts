import { writeFileSync } from 'fs';
import { resolveRepoPath, writeJsonFile } from '../io';
import {
  buildCaseSnapshotAlignmentRegistry,
  renderCaseSnapshotAlignmentMarkdown,
} from '../src/case-snapshot-alignment';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const jsonPath = parseArg(
    '--json',
    'evaluation/results/case-snapshot-alignment.v0.json',
  );
  const markdownPath = parseArg(
    '--markdown',
    'evaluation/results/case-snapshot-alignment.v0.md',
  );

  const registry = buildCaseSnapshotAlignmentRegistry();
  writeJsonFile(jsonPath, registry);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderCaseSnapshotAlignmentMarkdown(registry),
    'utf8',
  );

  console.log(`Wrote case snapshot alignment JSON to ${jsonPath}`);
  console.log(`Wrote case snapshot alignment markdown to ${markdownPath}`);
}

main();
