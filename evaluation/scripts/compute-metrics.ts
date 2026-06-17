import { computeMetrics } from '../metrics';
import { loadDataset, loadResults } from '../io';

function parseArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

function main(): void {
  const datasetPath = parseArg('--dataset') ?? 'evaluation/datasets/cases.v0.json';
  const resultsPath = parseArg('--results') ?? 'evaluation/results/results.v0.json';
  const baselineId = parseArg('--baseline');

  const dataset = loadDataset(datasetPath);
  const results = loadResults(resultsPath);
  const baselines = baselineId
    ? results.baselines.filter((baseline) => baseline.baselineId === baselineId)
    : results.baselines;

  if (baselines.length === 0) {
    throw new Error(
      baselineId
        ? `Baseline ${baselineId} not found in ${resultsPath}`
        : `No baselines found in ${resultsPath}`,
    );
  }

  for (const baseline of baselines) {
    const metrics = computeMetrics({
      cases: dataset.cases,
      predictions: baseline.predictions,
    });
    console.log(JSON.stringify({ baselineId: baseline.baselineId, metrics }, null, 2));
  }
}

main();
