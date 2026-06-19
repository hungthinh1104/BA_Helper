import { existsSync } from 'fs';
import { EvaluationPaths } from '../src/core/paths';
import { loadDataset, resolveRepoPath } from '../io';
import {
  buildMetricsReport,
  normalizeRegistryMethods,
  renderMetricsMarkdown,
} from '../metrics';
import { loadResultRegistry } from '../src/analysis/result-registry';
import { writeResult } from '../src/core/write-result';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const datasetPath = parseArg('--dataset', EvaluationPaths.datasetV0.cases);
  let resultsDir = parseArg('--resultsDir', '');
  if (!resultsDir) {
    resultsDir = existsSync(resolveRepoPath(EvaluationPaths.resultsV0.baselines))
      ? EvaluationPaths.resultsV0.baselines
      : EvaluationPaths.resultsLegacy.root;
  }

  const dataset = loadDataset(datasetPath);
  const registry = loadResultRegistry(resolveRepoPath(resultsDir));
  const methods = normalizeRegistryMethods(registry.methods);
  const scannerCoverageFailureCaseIds = dataset.cases
    .filter(
      (evaluationCase) =>
        evaluationCase.evaluationScope === 'E2E_SCANNER_COVERAGE_FAILURE',
    )
    .map((evaluationCase) => evaluationCase.id);
  const report = buildMetricsReport({
    methods,
    datasetCaseCount: dataset.cases.length,
    scannerCoverageFailureCaseIds,
    scannerCoverageFailureCaseCountSource: 'DATASET_METADATA',
    warnings: registry.warnings,
  });

  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.analysis + '/metrics.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.analysis + '/metrics.v0.md',
    legacyJsonPath: EvaluationPaths.resultsLegacy.analysis.metricsJson,
    legacyMarkdownPath: EvaluationPaths.resultsLegacy.analysis.metricsMd,
    jsonData: report,
    markdownData: renderMetricsMarkdown(report),
  });
}

main();
