import { writeFileSync } from 'fs';
import {
  buildMetricsReport,
  renderMetricsMarkdown,
  type MethodResultFileLike,
} from '../metrics';
import { loadDataset, readJsonFile, resolveRepoPath, writeJsonFile } from '../io';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function loadMethodResult(inputPath: string): MethodResultFileLike {
  const parsed = readJsonFile<MethodResultFileLike>(inputPath);
  if (
    !parsed ||
    typeof parsed.method !== 'string' ||
    typeof parsed.topK !== 'number' ||
    !Array.isArray(parsed.cases)
  ) {
    throw new Error(`Unsupported metrics input shape: ${inputPath}`);
  }
  return parsed;
}

function main(): void {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const keywordPath = parseArg(
    '--keyword',
    'evaluation/results/keyword-baseline.v0.json',
  );
  const jsonPath = parseArg('--json', 'evaluation/results/metrics.v0.json');
  const markdownPath = parseArg('--markdown', 'evaluation/results/metrics.v0.md');

  const dataset = loadDataset(datasetPath);
  const methods = [loadMethodResult(keywordPath)];
  const report = buildMetricsReport({
    methods,
    datasetCaseCount: dataset.cases.length,
  });

  writeJsonFile(jsonPath, report);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderMetricsMarkdown(report),
    'utf8',
  );

  console.log(`Wrote metrics JSON to ${jsonPath}`);
  console.log(`Wrote metrics markdown to ${markdownPath}`);
}

main();
