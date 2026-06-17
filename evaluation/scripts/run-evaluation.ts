import { writeFileSync } from 'fs';
import { computeMetrics } from '../metrics';
import { loadDataset, resolveRepoPath, writeJsonFile } from '../io';
import { runKeywordBaseline } from '../baselines/keyword-baseline';
import { runPureLlmBaseline } from '../baselines/pure-llm-baseline';
import { runVectorOnlyBaseline } from '../baselines/vector-only-baseline';
import type { BaselineRun, EvaluationResults } from '../types';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function renderMetricsMarkdown(results: EvaluationResults): string {
  const lines = [
    '# ReqImpact Evaluation Metrics v0',
    '',
    `Generated at: ${results.generatedAt}`,
    '',
    '| Baseline | Status | Precision | Recall | F1 | Recall@5 | Recall@10 | Evidence Coverage | Review Burden |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const baseline of results.baselines) {
    const metrics = results.metrics[baseline.baselineId];
    lines.push(
      `| ${baseline.baselineId} | ${baseline.status} | ${metrics.precision.toFixed(4)} | ${metrics.recall.toFixed(4)} | ${metrics.f1.toFixed(4)} | ${metrics.recallAt5.toFixed(4)} | ${metrics.recallAt10.toFixed(4)} | ${metrics.evidenceCoverage.toFixed(4)} | ${metrics.reviewBurden.toFixed(4)} |`,
    );
  }

  lines.push(
    '',
    'Notes:',
    '- `keyword-baseline` is deterministic lexical overlap scoring.',
    '- `vector-only-baseline` is deterministic sparse token-vector cosine scoring.',
    '- `pure-llm-baseline` is intentionally manual and skipped in the default scaffold.',
  );

  return `${lines.join('\n')}\n`;
}

function collectBaselines(): BaselineRun[] {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const dataset = loadDataset(datasetPath);
  return [
    runKeywordBaseline(dataset.cases),
    runVectorOnlyBaseline(dataset.cases),
    runPureLlmBaseline(dataset.cases),
  ];
}

function main(): void {
  const datasetPath = parseArg('--dataset', 'evaluation/datasets/cases.v0.json');
  const resultsPath = parseArg('--results', 'evaluation/results/results.v0.json');
  const markdownPath = parseArg('--markdown', 'evaluation/results/metrics.v0.md');
  const dataset = loadDataset(datasetPath);
  const baselines = collectBaselines();
  const metrics = Object.fromEntries(
    baselines.map((baseline) => [
      baseline.baselineId,
      computeMetrics({
        cases: dataset.cases,
        predictions: baseline.predictions,
      }),
    ]),
  );

  const results: EvaluationResults = {
    version: 'results.v0',
    generatedAt: new Date().toISOString(),
    datasetVersion: dataset.version,
    baselines,
    metrics,
  };

  writeJsonFile(resultsPath, results);
  writeFileSync(
    resolveRepoPath(markdownPath),
    renderMetricsMarkdown(results),
    'utf8',
  );

  console.log(`Wrote evaluation results to ${resultsPath}`);
  console.log(`Wrote metrics summary to ${markdownPath}`);
}

main();
