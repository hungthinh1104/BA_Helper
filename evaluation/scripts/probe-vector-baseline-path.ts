import { writeFileSync } from 'fs';
import { resolveRepoPath, writeJsonFile } from '../io';
import {
  probeVectorBaselinePath,
  renderVectorPathProbeMarkdown,
} from '../src/vector-path-probe';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const jsonPath = parseArg(
    '--json',
    'evaluation/results/vector-baseline-path.v0.json',
  );
  const markdownPath = parseArg(
    '--markdown',
    'evaluation/results/vector-baseline-path.v0.md',
  );

  const report = probeVectorBaselinePath();
  writeJsonFile(jsonPath, report);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderVectorPathProbeMarkdown(report),
    'utf8',
  );

  console.log(`Wrote vector path probe JSON to ${jsonPath}`);
  console.log(`Wrote vector path probe markdown to ${markdownPath}`);
}

main();
