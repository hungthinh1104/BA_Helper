import { writeFileSync } from 'fs';
import { resolveRepoPath, loadDataset, writeJsonFile } from '../io';
import {
  buildMetricsReport,
  normalizeRegistryMethods,
  renderMetricsMarkdown,
} from '../metrics';
import { loadResultRegistry } from '../src/result-registry';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main(): void {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const resultsDir = parseArg('--resultsDir', 'evaluation/results');
  const jsonPath = parseArg('--json', 'evaluation/results/metrics.v0.json');
  const markdownPath = parseArg('--markdown', 'evaluation/results/metrics.v0.md');

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
    warnings: registry.warnings,
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
