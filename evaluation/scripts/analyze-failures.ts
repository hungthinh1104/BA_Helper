import { writeFileSync } from 'fs';
import { writeResult } from '../src/core/write-result';
import { EvaluationPaths } from '../src/core/paths';
import { loadDataset, readJsonFile, resolveRepoPath, writeJsonFile } from '../io';
import type { MetricsReport } from '../metrics';
import {
  analyzeLexicalBaselineFailures,
  renderFailureAnalysisMarkdown,
} from '../src/analysis/failure-analysis';
import { loadResultRegistry } from '../src/analysis/result-registry';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const datasetPath = parseArg('--dataset', EvaluationPaths.datasetV0.cases);
  const resultsDir = parseArg('--resultsDir', 'evaluation/results');
  const metricsPath = parseArg('--metrics', EvaluationPaths.resultsLegacy.analysis.metricsJson);
  const jsonPath = parseArg(
    '--json',
    EvaluationPaths.resultsLegacy.analysis.failuresJson,
  );
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.analysis.failuresMd,
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

  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.analysis + '/failure-analysis.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.analysis + '/failure-analysis.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: report,
    markdownData: renderFailureAnalysisMarkdown(report),
  });
}

main();
