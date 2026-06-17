import { writeFileSync } from 'fs';
import { loadDataset, readJsonFile, resolveRepoPath, writeJsonFile } from '../io';
import type { MetricsReport } from '../metrics';
import {
  analyzeLexicalBaselineFailures,
  renderFailureAnalysisMarkdown,
} from '../src/failure-analysis';
import { loadResultRegistry } from '../src/result-registry';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const resultsDir = parseArg('--resultsDir', 'evaluation/results');
  const metricsPath = parseArg('--metrics', 'evaluation/results/metrics.v0.json');
  const jsonPath = parseArg(
    '--json',
    'evaluation/results/failure-analysis.v0.json',
  );
  const markdownPath = parseArg(
    '--markdown',
    'evaluation/results/failure-analysis.v0.md',
  );

  const dataset = loadDataset(datasetPath);
  const registry = loadResultRegistry(resolveRepoPath(resultsDir));
  const metricsReport = readJsonFile<MetricsReport>(metricsPath);
  const report = analyzeLexicalBaselineFailures({
    datasetCases: dataset.cases,
    methods: registry.methods,
    metricsReport,
    warnings: registry.warnings,
  });

  writeJsonFile(jsonPath, report);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderFailureAnalysisMarkdown(report),
    'utf8',
  );

  console.log(`Wrote failure analysis JSON to ${jsonPath}`);
  console.log(`Wrote failure analysis markdown to ${markdownPath}`);
}

main();
