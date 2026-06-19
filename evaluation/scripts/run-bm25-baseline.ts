import { writeResult } from '../src/core/write-result';
import { EvaluationPaths } from '../src/core/paths';
import { loadDataset } from '../io';
import {
  runBm25BaselineDetailed,
  type Bm25BaselineCaseResult,
  type Bm25BaselineOutput,
} from '../baselines/bm25-baseline';

function parseArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseTopK(): number {
  const raw = parseArg('--topK', '10');
  const topK = Number.parseInt(raw, 10);
  if (!Number.isFinite(topK) || topK <= 0) {
    throw new Error(`Invalid --topK value: ${raw}`);
  }
  return topK;
}

function formatList(items: string[]): string {
  return items.length === 0 ? 'None' : items.join('<br>');
}

function renderCaseTopK(caseResult: Bm25BaselineCaseResult): string[] {
  const lines = [
    `## ${caseResult.caseId}`,
    '',
    `Repo: \`${caseResult.repo}\``,
    '',
    `Requirement: ${caseResult.requirementText}`,
    '',
    '| Rank | Artifact | File | Type | Score | Matched Tokens |',
    '| ---: | --- | --- | --- | ---: | --- |',
  ];

  if (caseResult.results.length === 0) {
    lines.push('| - | No matched artifacts | - | - | 0 | - |');
  } else {
    for (const result of caseResult.results) {
      lines.push(
        `| ${result.rank} | \`${result.artifactKey}\` | \`${result.filePath}\` | \`${result.artifactType}\` | ${result.score.toFixed(4)} | ${result.matchedTokens.join(', ')} |`,
      );
    }
  }

  lines.push(
    '',
    `Missed ground-truth files: ${formatList(caseResult.summary.missedGroundTruthFiles)}`,
    '',
    `Unexpected top-K files: ${formatList(caseResult.summary.unexpectedTopKFiles)}`,
    '',
  );

  return lines;
}

function renderMarkdown(output: Bm25BaselineOutput): string {
  const averageRecallAt10 =
    output.cases.length === 0
      ? 0
      : output.cases.reduce((sum, caseResult) => sum + caseResult.summary.recallAt10, 0) /
        output.cases.length;
  const totalHits = output.cases.reduce(
    (sum, caseResult) => sum + caseResult.summary.groundTruthHitCount,
    0,
  );

  const lines = [
    '# BM25 Baseline v0',
    '',
    `Generated at: ${output.generatedAt}`,
    '',
    'This is a deterministic BM25 lexical baseline, not vector retrieval.',
    'Changed files are proxy ground truth.',
    'File-level only.',
    '',
    `Top K: ${output.topK}`,
    `Average Recall@10 across cases: ${averageRecallAt10.toFixed(4)}`,
    `Total top-10 ground-truth hits: ${totalHits}`,
    '',
    '| Case ID | Repo | R@10 | Hit Count | Missed Files |',
    '| --- | --- | ---: | ---: | --- |',
  ];

  for (const caseResult of output.cases) {
    lines.push(
      `| ${caseResult.caseId} | \`${caseResult.repo}\` | ${caseResult.summary.recallAt10.toFixed(4)} | ${caseResult.summary.groundTruthHitCount} | ${formatList(caseResult.summary.missedGroundTruthFiles)} |`,
    );
  }

  if (output.warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  for (const caseResult of output.cases) {
    lines.push('', ...renderCaseTopK(caseResult));
  }

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const datasetPath = parseArg('--dataset', EvaluationPaths.datasetV0.cases);
  const jsonPath = parseArg('--json', EvaluationPaths.resultsLegacy.baselines.bm25Json);
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.baselines.bm25Md,
  );
  const topK = parseTopK();
  const dataset = loadDataset(datasetPath);
  const output = runBm25BaselineDetailed({
    cases: dataset.cases,
    topK,
  });

  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.baselines + '/bm25-baseline.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.baselines + '/bm25-baseline.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: output,
    markdownData: renderMarkdown(output)
  });

  console.log(`Wrote BM25 baseline JSON to canonical path and legacy alias`);
  console.log(`Wrote BM25 baseline markdown to canonical path and legacy alias`);
}

main();
