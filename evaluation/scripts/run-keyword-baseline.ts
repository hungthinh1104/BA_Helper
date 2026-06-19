import { writeResult } from '../src/core/write-result';
import { EvaluationPaths } from '../src/core/paths';
import { loadDataset } from '../io';
import {
  runKeywordBaselineDetailed,
  type KeywordBaselineCaseResult,
  type KeywordBaselineOutput,
} from '../baselines/keyword-baseline';

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

function renderCaseTopK(caseResult: KeywordBaselineCaseResult): string[] {
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
        `| ${result.rank} | \`${result.artifactKey}\` | \`${result.filePath}\` | \`${result.artifactType}\` | ${result.score.toFixed(2)} | ${result.matchedTokens.join(', ')} |`,
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

function renderMarkdown(output: KeywordBaselineOutput): string {
  const lines = [
    '# Keyword Baseline v0',
    '',
    `Generated at: ${output.generatedAt}`,
    '',
    'This is a deterministic keyword baseline, not ReqImpact hybrid retrieval.',
    'Changed files are proxy ground truth.',
    'This result is file-level only, not method-level.',
    '',
    `Top K: ${output.topK}`,
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
  const jsonPath = parseArg('--json', EvaluationPaths.resultsLegacy.baselines.keywordJson);
  const markdownPath = parseArg(
    '--markdown',
    EvaluationPaths.resultsLegacy.baselines.keywordMd,
  );
  const topK = parseTopK();
  const dataset = loadDataset(datasetPath);
  const output = runKeywordBaselineDetailed({
    cases: dataset.cases,
    topK,
  });

  writeResult({
    canonicalJsonPath: EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.json',
    canonicalMarkdownPath: EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.md',
    legacyJsonPath: jsonPath,
    legacyMarkdownPath: markdownPath,
    jsonData: output,
    markdownData: renderMarkdown(output),
  });
}

main();
