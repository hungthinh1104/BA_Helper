import { writeFileSync } from 'fs';
import { loadDataset, readJsonFile, resolveRepoPath, writeJsonFile } from '../io';
import type { MetricsReport } from '../metrics';
import {
  analyzeKeywordBaselineFailures,
  renderFailureAnalysisMarkdown,
  type KeywordBaselineResultFile,
} from '../src/failure-analysis';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const keywordPath = parseArg(
    '--keyword',
    'evaluation/results/keyword-baseline.v0.json',
  );
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
  const keywordResults = readJsonFile<KeywordBaselineResultFile>(keywordPath);
  const metricsReport = readJsonFile<MetricsReport>(metricsPath);
  const report = analyzeKeywordBaselineFailures({
    datasetCases: dataset.cases,
    keywordResults,
    metricsReport,
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
