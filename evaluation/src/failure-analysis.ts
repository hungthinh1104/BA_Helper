import type {
  EvaluationCase,
  FailureCategory,
} from './types';
import type {
  CaseMetrics,
  MetricsReport,
} from '../metrics';

export type KeywordBaselineResultFile = {
  runId: string;
  generatedAt: string;
  method: 'keyword-baseline-v0';
  topK: number;
  cases: Array<{
    caseId: string;
    repo: string;
    requirementText: string;
    groundTruthFiles: string[];
    results: Array<{
      rank: number;
      artifactKey: string;
      filePath: string;
      artifactType: string;
      score: number;
      matchedTokens: string[];
      retrievalReason: string;
    }>;
    summary: {
      groundTruthHitCount: number;
      recallAt10: number;
      missedGroundTruthFiles: string[];
      unexpectedTopKFiles: string[];
    };
  }>;
  warnings: string[];
};

export type FailureOutcome = 'PASS_FULL' | 'PASS_PARTIAL' | 'FAIL_MISS';

export type FutureHypothesis = {
  hypothesis: string;
  needsEvidenceFrom:
    | 'CURRENT_HYBRID'
    | 'VECTOR_BASELINE'
    | 'R1_EMBEDDING'
    | 'DB_SNAPSHOT';
};

export type FailureAnalysisCase = {
  caseId: string;
  repo: string;
  outcome: FailureOutcome;
  recallAt10: number;
  precisionAt10: number;
  f1At10: number;
  hitGroundTruthFiles: string[];
  missedGroundTruthFiles: string[];
  unexpectedTopKFiles: string[];
  topRankedFiles: string[];
  observedFailureCategories: FailureCategory[];
  observedExplanation: string;
  hypothesesForFutureEvaluation: FutureHypothesis[];
};

export type FailureAnalysisReport = {
  runId: string;
  generatedAt: string;
  method: 'keyword-baseline-v0';
  dataset: {
    caseCount: number;
    groundTruthType: 'changed-files-proxy';
    evaluationLevel: 'file';
  };
  summary: {
    passFullCount: number;
    passPartialCount: number;
    failMissCount: number;
    categoryCounts: Partial<Record<FailureCategory, number>>;
  };
  cases: FailureAnalysisCase[];
  warnings: string[];
};

const FORBIDDEN_OBSERVED_CATEGORIES = new Set<FailureCategory>([
  'VECTOR_THIN_CHUNK',
  'GRAPH_EDGE_MISSING',
  'GRAPH_NOISE',
  'LLM_EVIDENCE_OVERCLAIM',
  'EVIDENCE_LOCATION_ONLY',
  'STALE_SNAPSHOT_OR_INDEX',
]);

function isDataModelFile(filePath: string): boolean {
  return /(entity|model|schema|prisma)\./i.test(filePath) || /schema\.prisma$/i.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return /\.(spec|test)\./i.test(filePath) || /__tests__/i.test(filePath);
}

function classifyOutcome(recallAt10: number): FailureOutcome {
  if (recallAt10 === 1) {
    return 'PASS_FULL';
  }
  if (recallAt10 > 0) {
    return 'PASS_PARTIAL';
  }
  return 'FAIL_MISS';
}

function buildCaseMaps(report: MetricsReport, method: string): Map<string, CaseMetrics> {
  const methodReport = report.methods.find((entry) => entry.method === method);
  if (!methodReport) {
    throw new Error(`Method ${method} not found in metrics report.`);
  }
  return new Map(methodReport.caseMetrics.map((metric) => [metric.caseId, metric]));
}

function buildDatasetCaseMap(cases: EvaluationCase[]): Map<string, EvaluationCase> {
  return new Map(cases.map((item) => [item.id, item]));
}

function uniqueCategories(categories: FailureCategory[]): FailureCategory[] {
  return [...new Set(categories)];
}

function categorizeObservedFailures(params: {
  evaluationCase: EvaluationCase;
  metrics: CaseMetrics;
  keywordCase: KeywordBaselineResultFile['cases'][number];
}): FailureCategory[] {
  const categories: FailureCategory[] = [];
  const candidateArtifactFiles = new Set(
    params.evaluationCase.candidateArtifacts.map((artifact) => artifact.filePath),
  );

  if (
    params.metrics.missedGroundTruthFiles.some(
      (filePath) => !candidateArtifactFiles.has(filePath),
    )
  ) {
    categories.push('SCANNER_MISSING_ARTIFACT');
  }

  if (
    params.metrics.recallAt10 === 0 &&
    params.keywordCase.results.length === 0 &&
    categories.length === 0
  ) {
    categories.push('LEXICAL_MISMATCH');
  }

  if (
    params.metrics.missedGroundTruthFiles.length > 0 &&
    params.metrics.unexpectedTopKFiles.length > 0
  ) {
    categories.push('SUPPORT_FILE_OVER_RETRIEVED');
  }

  if (
    params.metrics.missedGroundTruthFiles.some((filePath) => isDataModelFile(filePath))
  ) {
    categories.push('DATA_MODEL_MISSED');
  }

  if (params.metrics.missedGroundTruthFiles.some((filePath) => isTestFile(filePath))) {
    categories.push('TEST_ARTIFACT_MISSED');
  }

  const matchedTokens = new Set(
    params.keywordCase.results.flatMap((result) => result.matchedTokens),
  );
  const requirementText = params.keywordCase.requirementText.toLowerCase();
  if (
    params.metrics.missedGroundTruthFiles.length > 0 &&
    params.keywordCase.results.length > 0 &&
    (matchedTokens.has('author') ||
      requirementText.includes('author') ||
      requirementText.includes('relation') ||
      requirementText.includes('workflow'))
  ) {
    categories.push('DOMAIN_ALIAS_MISSING');
  }

  if (
    params.metrics.missedGroundTruthFiles.length > 0 &&
    params.keywordCase.results.length > 0 &&
    params.metrics.hitGroundTruthFiles.length > 0
  ) {
    categories.push('INDIRECT_DEPENDENCY_MISSED');
  }

  return uniqueCategories(categories).filter(
    (category) => !FORBIDDEN_OBSERVED_CATEGORIES.has(category),
  );
}

function buildObservedExplanation(params: {
  outcome: FailureOutcome;
  metrics: CaseMetrics;
  keywordCase: KeywordBaselineResultFile['cases'][number];
  observedFailureCategories: FailureCategory[];
}): string {
  const topFiles = params.keywordCase.results
    .slice(0, 3)
    .map((result) => result.filePath);

  if (params.outcome === 'PASS_FULL' && params.observedFailureCategories.length === 0) {
    return 'All proxy ground-truth files were retrieved within top-10 by exact file-path match.';
  }

  if (params.outcome === 'FAIL_MISS' && params.keywordCase.results.length === 0) {
    return `No candidate artifact achieved keyword overlap with the requirement text, so every proxy ground-truth file was missed.`;
  }

  const parts: string[] = [];
  if (params.metrics.hitGroundTruthFiles.length > 0) {
    parts.push(
      `Keyword overlap retrieved ${params.metrics.hitGroundTruthFiles.length} ground-truth file(s).`,
    );
  }
  if (params.metrics.missedGroundTruthFiles.length > 0) {
    parts.push(
      `It still missed ${params.metrics.missedGroundTruthFiles.length} ground-truth file(s).`,
    );
  }
  if (params.metrics.unexpectedTopKFiles.length > 0) {
    parts.push(
      `Top-10 also included ${params.metrics.unexpectedTopKFiles.length} non-ground-truth file(s).`,
    );
  }
  if (topFiles.length > 0) {
    parts.push(`Top ranked files were: ${topFiles.join(', ')}.`);
  }

  return parts.join(' ');
}

function buildHypotheses(params: {
  outcome: FailureOutcome;
  metrics: CaseMetrics;
  observedFailureCategories: FailureCategory[];
}): FutureHypothesis[] {
  const hypotheses: FutureHypothesis[] = [];

  if (
    params.observedFailureCategories.includes('LEXICAL_MISMATCH') ||
    params.observedFailureCategories.includes('DOMAIN_ALIAS_MISSING')
  ) {
    hypotheses.push({
      hypothesis:
        'A semantic retrieval baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.',
      needsEvidenceFrom: 'VECTOR_BASELINE',
    });
  }

  if (params.observedFailureCategories.includes('INDIRECT_DEPENDENCY_MISSED')) {
    hypotheses.push({
      hypothesis:
        'Hybrid retrieval may recover indirect dependency files if structural evidence links them to the retrieved direct hits.',
      needsEvidenceFrom: 'CURRENT_HYBRID',
    });
  }

  if (params.observedFailureCategories.includes('SCANNER_MISSING_ARTIFACT')) {
    hypotheses.push({
      hypothesis:
        'Dataset candidates or snapshot-export completeness should be verified before comparing stronger retrieval methods.',
      needsEvidenceFrom: 'DB_SNAPSHOT',
    });
  }

  if (
    params.metrics.unexpectedTopKFiles.length > 0 ||
    params.outcome === 'PASS_FULL'
  ) {
    hypotheses.push({
      hypothesis:
        'Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.',
      needsEvidenceFrom: 'CURRENT_HYBRID',
    });
  }

  return hypotheses;
}

export function analyzeKeywordBaselineFailures(params: {
  datasetCases: EvaluationCase[];
  keywordResults: KeywordBaselineResultFile;
  metricsReport: MetricsReport;
  generatedAt?: string;
  runId?: string;
}): FailureAnalysisReport {
  const caseById = buildDatasetCaseMap(params.datasetCases);
  const metricsByCaseId = buildCaseMaps(params.metricsReport, 'keyword-baseline-v0');

  const cases = params.keywordResults.cases.map((keywordCase) => {
    const evaluationCase = caseById.get(keywordCase.caseId);
    const metrics = metricsByCaseId.get(keywordCase.caseId);

    if (!evaluationCase) {
      throw new Error(`Dataset case ${keywordCase.caseId} not found.`);
    }
    if (!metrics) {
      throw new Error(`Metrics for case ${keywordCase.caseId} not found.`);
    }

    const outcome = classifyOutcome(metrics.recallAt10);
    const observedFailureCategories = categorizeObservedFailures({
      evaluationCase,
      metrics,
      keywordCase,
    });

    return {
      caseId: keywordCase.caseId,
      repo: keywordCase.repo,
      outcome,
      recallAt10: metrics.recallAt10,
      precisionAt10: metrics.precisionAt10,
      f1At10: metrics.f1At10,
      hitGroundTruthFiles: metrics.hitGroundTruthFiles,
      missedGroundTruthFiles: metrics.missedGroundTruthFiles,
      unexpectedTopKFiles: metrics.unexpectedTopKFiles,
      topRankedFiles: keywordCase.results.map((result) => result.filePath),
      observedFailureCategories,
      observedExplanation: buildObservedExplanation({
        outcome,
        metrics,
        keywordCase,
        observedFailureCategories,
      }),
      hypothesesForFutureEvaluation: buildHypotheses({
        outcome,
        metrics,
        observedFailureCategories,
      }),
    } satisfies FailureAnalysisCase;
  });

  const categoryCounts = cases.reduce<Partial<Record<FailureCategory, number>>>(
    (counts, caseResult) => {
      for (const category of caseResult.observedFailureCategories) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );

  return {
    runId: params.runId ?? `failure-analysis-v0-${cases.length}`,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    method: 'keyword-baseline-v0',
    dataset: {
      caseCount: params.datasetCases.length,
      groundTruthType: 'changed-files-proxy',
      evaluationLevel: 'file',
    },
    summary: {
      passFullCount: cases.filter((item) => item.outcome === 'PASS_FULL').length,
      passPartialCount: cases.filter((item) => item.outcome === 'PASS_PARTIAL')
        .length,
      failMissCount: cases.filter((item) => item.outcome === 'FAIL_MISS').length,
      categoryCounts,
    },
    cases,
    warnings: [
      'Changed files are proxy ground truth, not absolute impacted files.',
      'This failure analysis is based on keyword-baseline-v0 only.',
      'No vector, graph, DB, LLM, or R1 behavior is evaluated here.',
    ],
  };
}

export function renderFailureAnalysisMarkdown(
  report: FailureAnalysisReport,
): string {
  const lines = [
    '# Failure Analysis v0 — Keyword Baseline',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    'This analyzes keyword-baseline-v0 only.',
    'Changed files are proxy ground truth.',
    'File-level only.',
    'No vector, graph, DB, LLM, or R1 behavior is evaluated.',
    '',
    '## Summary',
    '',
    `- PASS_FULL: ${report.summary.passFullCount}`,
    `- PASS_PARTIAL: ${report.summary.passPartialCount}`,
    `- FAIL_MISS: ${report.summary.failMissCount}`,
    '',
    '| Category | Count |',
    '| --- | ---: |',
  ];

  const categoryEntries = Object.entries(report.summary.categoryCounts).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  if (categoryEntries.length === 0) {
    lines.push('| None | 0 |');
  } else {
    for (const [category, count] of categoryEntries) {
      lines.push(`| ${category} | ${count} |`);
    }
  }

  for (const caseResult of report.cases) {
    lines.push(
      '',
      `## ${caseResult.caseId}`,
      '',
      `- Outcome: ${caseResult.outcome}`,
      `- Repo: \`${caseResult.repo}\``,
      `- R@10: ${caseResult.recallAt10.toFixed(4)}`,
      `- P@10: ${caseResult.precisionAt10.toFixed(4)}`,
      `- F1@10: ${caseResult.f1At10.toFixed(4)}`,
      `- Hit files: ${
        caseResult.hitGroundTruthFiles.length === 0
          ? 'None'
          : caseResult.hitGroundTruthFiles.join(', ')
      }`,
      `- Missed files: ${
        caseResult.missedGroundTruthFiles.length === 0
          ? 'None'
          : caseResult.missedGroundTruthFiles.join(', ')
      }`,
      `- Observed categories: ${
        caseResult.observedFailureCategories.length === 0
          ? 'None'
          : caseResult.observedFailureCategories.join(', ')
      }`,
      `- Explanation: ${caseResult.observedExplanation}`,
      `- Top ranked files: ${
        caseResult.topRankedFiles.length === 0
          ? 'None'
          : caseResult.topRankedFiles.join(', ')
      }`,
      '',
      'Future hypotheses:',
    );

    if (caseResult.hypothesesForFutureEvaluation.length === 0) {
      lines.push('- None');
    } else {
      for (const hypothesis of caseResult.hypothesesForFutureEvaluation) {
        lines.push(
          `- [${hypothesis.needsEvidenceFrom}] ${hypothesis.hypothesis}`,
        );
      }
    }
  }

  lines.push(
    '',
    '## Implications for next phase',
    '',
    '- Lexical miss cases support adding a vector-only baseline where requirement wording and artifact identifiers do not align directly.',
    '- Over-retrieval cases justify tracking precision and review burden, not recall alone.',
    '- If any ground-truth file is absent from candidateArtifacts, candidate completeness should be corrected before R1 comparisons.',
    '',
    '## Warnings',
    '',
  );

  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}
