import type { EvaluationCase, FailureCategory } from '../core/types';
import type { CaseMetrics, MetricsReport } from '../../metrics';
import type { NormalizedResultMethod } from './result-registry';

export type FailureOutcome = 'PASS_FULL' | 'PASS_PARTIAL' | 'FAIL_MISS';

export type FutureHypothesis = {
  hypothesis: string;
  needsEvidenceFrom:
    | 'CURRENT_HYBRID'
    | 'VECTOR_BASELINE'
    | 'R1_EMBEDDING'
    | 'DB_SNAPSHOT';
};

export type FailureAnalysisMethodCase = {
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

export type FailureAnalysisMethod = {
  method: string;
  sourceFile: string;
  passFullCount: number;
  passPartialCount: number;
  failMissCount: number;
  categoryCounts: Partial<Record<FailureCategory, number>>;
  cases: FailureAnalysisMethodCase[];
};

export type CrossMethodComparison = {
  caseId: string;
  repo: string;
  keywordOutcome: FailureOutcome | 'NOT_AVAILABLE';
  bm25Outcome: FailureOutcome | 'NOT_AVAILABLE';
  bm25VsKeywordRecallAt10: 'IMPROVED' | 'REGRESSED' | 'TIED' | 'NOT_COMPARABLE';
  bm25ChangedTopRankedFiles: boolean;
  note: string;
};

export type MultiMethodFailureAnalysisReport = {
  runId: string;
  generatedAt: string;
  dataset: {
    caseCount: number;
    groundTruthType: 'changed-files-proxy';
    evaluationLevel: 'file';
  };
  methods: FailureAnalysisMethod[];
  crossMethodComparison: CrossMethodComparison[];
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

export function classifyOutcome(recallAt10: number): FailureOutcome {
  if (recallAt10 === 1) {
    return 'PASS_FULL';
  }
  if (recallAt10 > 0) {
    return 'PASS_PARTIAL';
  }
  return 'FAIL_MISS';
}

function buildDatasetCaseMap(cases: EvaluationCase[]): Map<string, EvaluationCase> {
  return new Map(cases.map((item) => [item.id, item]));
}

function buildMethodCaseMetricsMap(
  report: MetricsReport,
  method: string,
): Map<string, CaseMetrics> {
  const methodReport = report.methods.find((entry) => entry.method === method);
  if (!methodReport) {
    throw new Error(`Method ${method} not found in metrics report.`);
  }
  return new Map(methodReport.caseMetrics.map((metric) => [metric.caseId, metric]));
}

function uniqueCategories(categories: FailureCategory[]): FailureCategory[] {
  return [...new Set(categories)];
}

function categorizeObservedFailures(params: {
  evaluationCase: EvaluationCase;
  metrics: CaseMetrics;
  methodCase: NormalizedResultMethod['cases'][number];
}): FailureCategory[] {
  const categories: FailureCategory[] = [];
  const candidateArtifactFiles = new Set(
    params.evaluationCase.candidateArtifacts.map((artifact) => artifact.filePath),
  );

  if (params.evaluationCase.evaluationScope === 'E2E_SCANNER_COVERAGE_FAILURE') {
    categories.push('SCANNER_MISSING_ARTIFACT');
  }

  if (
    params.metrics.missedGroundTruthFiles.some(
      (filePath) => !candidateArtifactFiles.has(filePath),
    )
  ) {
    categories.push('SCANNER_MISSING_ARTIFACT');
  }

  if (
    params.metrics.recallAt10 === 0 &&
    params.methodCase.rankedResults.length === 0 &&
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

  if (params.metrics.missedGroundTruthFiles.some((filePath) => isDataModelFile(filePath))) {
    categories.push('DATA_MODEL_MISSED');
  }

  if (params.metrics.missedGroundTruthFiles.some((filePath) => isTestFile(filePath))) {
    categories.push('TEST_ARTIFACT_MISSED');
  }

  const matchedTokens = new Set(
    params.methodCase.rankedResults.flatMap((result) => {
      const value = (result as { matchedTokens?: string[] }).matchedTokens;
      return Array.isArray(value) ? value : [];
    }),
  );
  const requirementText = (params.methodCase.requirementText ?? '').toLowerCase();
  if (
    params.metrics.missedGroundTruthFiles.length > 0 &&
    params.methodCase.rankedResults.length > 0 &&
    (matchedTokens.has('author') ||
      requirementText.includes('author') ||
      requirementText.includes('relation') ||
      requirementText.includes('workflow'))
  ) {
    categories.push('DOMAIN_ALIAS_MISSING');
  }

  if (
    params.metrics.missedGroundTruthFiles.length > 0 &&
    params.methodCase.rankedResults.length > 0 &&
    params.metrics.hitGroundTruthFiles.length > 0
  ) {
    categories.push('INDIRECT_DEPENDENCY_MISSED');
  }

  return uniqueCategories(categories).filter(
    (category) => !FORBIDDEN_OBSERVED_CATEGORIES.has(category),
  );
}

function buildObservedExplanation(params: {
  evaluationCase: EvaluationCase;
  outcome: FailureOutcome;
  metrics: CaseMetrics;
  methodCase: NormalizedResultMethod['cases'][number];
  observedFailureCategories: FailureCategory[];
}): string {
  const topFiles = params.methodCase.rankedResults
    .slice(0, 3)
    .map((result) => result.filePath);

  if (params.outcome === 'PASS_FULL' && params.observedFailureCategories.length === 0) {
    return 'All proxy ground-truth files were retrieved within top-10 by exact file-path match.';
  }

  if (params.outcome === 'FAIL_MISS' && params.methodCase.rankedResults.length === 0) {
    return 'No candidate artifact achieved lexical overlap with the requirement text, so every proxy ground-truth file was missed.';
  }

  const parts: string[] = [];
  if (params.evaluationCase.evaluationScope === 'E2E_SCANNER_COVERAGE_FAILURE') {
    parts.push(
      'This case is labeled as an end-to-end scanner coverage failure, so retrieval metrics must not be read as clean retrieval-only performance.',
    );
  }
  if (params.metrics.hitGroundTruthFiles.length > 0) {
    parts.push(
      `Lexical ranking retrieved ${params.metrics.hitGroundTruthFiles.length} ground-truth file(s).`,
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
        'A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.',
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

  if (params.metrics.unexpectedTopKFiles.length > 0 || params.outcome === 'PASS_FULL') {
    hypotheses.push({
      hypothesis:
        'Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.',
      needsEvidenceFrom: 'CURRENT_HYBRID',
    });
  }

  return hypotheses;
}

function analyzeMethod(params: {
  datasetCaseMap: Map<string, EvaluationCase>;
  method: NormalizedResultMethod;
  metricsReport: MetricsReport;
}): FailureAnalysisMethod {
  const metricsByCaseId = buildMethodCaseMetricsMap(params.metricsReport, params.method.method);

  const cases = params.method.cases.map((methodCase) => {
    const evaluationCase = params.datasetCaseMap.get(methodCase.caseId);
    const metrics = metricsByCaseId.get(methodCase.caseId);

    if (!evaluationCase) {
      throw new Error(`Dataset case ${methodCase.caseId} not found.`);
    }
    if (!metrics) {
      throw new Error(`Metrics for case ${methodCase.caseId} and method ${params.method.method} not found.`);
    }

    const outcome = classifyOutcome(metrics.recallAt10);
    const observedFailureCategories = categorizeObservedFailures({
      evaluationCase,
      metrics,
      methodCase,
    });

    return {
      caseId: methodCase.caseId,
      repo: methodCase.repo,
      outcome,
      recallAt10: metrics.recallAt10,
      precisionAt10: metrics.precisionAt10,
      f1At10: metrics.f1At10,
      hitGroundTruthFiles: metrics.hitGroundTruthFiles,
      missedGroundTruthFiles: metrics.missedGroundTruthFiles,
      unexpectedTopKFiles: metrics.unexpectedTopKFiles,
      topRankedFiles: methodCase.rankedResults.map((result) => result.filePath),
      observedFailureCategories,
      observedExplanation: buildObservedExplanation({
        evaluationCase,
        outcome,
        metrics,
        methodCase,
        observedFailureCategories,
      }),
      hypothesesForFutureEvaluation: buildHypotheses({
        outcome,
        metrics,
        observedFailureCategories,
      }),
    };
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
    method: params.method.method,
    sourceFile: params.method.sourceFile,
    passFullCount: cases.filter((item) => item.outcome === 'PASS_FULL').length,
    passPartialCount: cases.filter((item) => item.outcome === 'PASS_PARTIAL').length,
    failMissCount: cases.filter((item) => item.outcome === 'FAIL_MISS').length,
    categoryCounts,
    cases,
  };
}

function compareRecallAt10(
  keywordCase: FailureAnalysisMethodCase | undefined,
  bm25Case: FailureAnalysisMethodCase | undefined,
): CrossMethodComparison['bm25VsKeywordRecallAt10'] {
  if (!keywordCase || !bm25Case) {
    return 'NOT_COMPARABLE';
  }
  if (bm25Case.recallAt10 > keywordCase.recallAt10) {
    return 'IMPROVED';
  }
  if (bm25Case.recallAt10 < keywordCase.recallAt10) {
    return 'REGRESSED';
  }
  return 'TIED';
}

function buildCrossMethodComparison(methods: FailureAnalysisMethod[]): CrossMethodComparison[] {
  const keyword = methods.find((method) => method.method === 'keyword-baseline-v0');
  const bm25 = methods.find((method) => method.method === 'bm25-baseline-v0');
  const caseIds = new Set([
    ...(keyword?.cases.map((item) => item.caseId) ?? []),
    ...(bm25?.cases.map((item) => item.caseId) ?? []),
  ]);

  return [...caseIds].map((caseId) => {
    const keywordCase = keyword?.cases.find((item) => item.caseId === caseId);
    const bm25Case = bm25?.cases.find((item) => item.caseId === caseId);
    const changedTopRankedFiles =
      JSON.stringify(keywordCase?.topRankedFiles ?? []) !==
      JSON.stringify(bm25Case?.topRankedFiles ?? []);
    const comparison = compareRecallAt10(keywordCase, bm25Case);

    let note = 'Methods are not directly comparable for this case.';
    if (comparison === 'TIED') {
      note = changedTopRankedFiles
        ? 'BM25 tied keyword at R@10 but changed the top-ranked file order.'
        : 'BM25 tied keyword at R@10 and preserved the same top-ranked file set/order.';
    } else if (comparison === 'IMPROVED') {
      note = 'BM25 improved file-level recall over keyword on this case.';
    } else if (comparison === 'REGRESSED') {
      note = 'BM25 regressed file-level recall relative to keyword on this case.';
    }

    return {
      caseId,
      repo: keywordCase?.repo ?? bm25Case?.repo ?? 'unknown',
      keywordOutcome: keywordCase?.outcome ?? 'NOT_AVAILABLE',
      bm25Outcome: bm25Case?.outcome ?? 'NOT_AVAILABLE',
      bm25VsKeywordRecallAt10: comparison,
      bm25ChangedTopRankedFiles: changedTopRankedFiles,
      note,
    };
  });
}

export function analyzeLexicalBaselineFailures(params: {
  datasetCases: EvaluationCase[];
  methods: NormalizedResultMethod[];
  metricsReport: MetricsReport;
  warnings?: string[];
  generatedAt?: string;
  runId?: string;
}): MultiMethodFailureAnalysisReport {
  const datasetCaseMap = buildDatasetCaseMap(params.datasetCases);
  const methods = params.methods.map((method) =>
    analyzeMethod({
      datasetCaseMap,
      method,
      metricsReport: params.metricsReport,
    }),
  );
  const crossMethodComparison = buildCrossMethodComparison(methods);
  const keywordAggregate = params.metricsReport.methods.find(
    (method) => method.method === 'keyword-baseline-v0',
  )?.aggregate;
  const bm25Aggregate = params.metricsReport.methods.find(
    (method) => method.method === 'bm25-baseline-v0',
  )?.aggregate;

  const warnings = [
    'This analyzes deterministic lexical baselines only.',
    'Changed files are proxy ground truth.',
    'File-level only.',
    'No vector, graph, DB, LLM, or R1 behavior is evaluated.',
    ...(keywordAggregate && bm25Aggregate &&
    keywordAggregate.macroRecallAt10 === bm25Aggregate.macroRecallAt10 &&
    keywordAggregate.macroPrecisionAt10 === bm25Aggregate.macroPrecisionAt10 &&
    keywordAggregate.macroF1At10 === bm25Aggregate.macroF1At10
      ? [
          'BM25 did not improve aggregate file-level retrieval over keyword-baseline-v0 on dataset v0.',
        ]
      : []),
    ...(params.warnings ?? []),
  ];

  return {
    runId: params.runId ?? `failure-analysis-v0-${methods.length}`,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    dataset: {
      caseCount: params.datasetCases.length,
      groundTruthType: 'changed-files-proxy',
      evaluationLevel: 'file',
    },
    methods,
    crossMethodComparison,
    warnings,
  };
}

export function renderFailureAnalysisMarkdown(
  report: MultiMethodFailureAnalysisReport,
): string {
  const lines = [
    '# Failure Analysis v0 — Lexical Baselines',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    'This analyzes deterministic lexical baselines only.',
    'Changed files are proxy ground truth.',
    'File-level only.',
    'No vector, graph, DB, LLM, or R1 behavior is evaluated.',
    '',
    '## Method Summary',
    '',
    '| Method | PASS_FULL | PASS_PARTIAL | FAIL_MISS |',
    '| --- | ---: | ---: | ---: |',
  ];

  for (const method of report.methods) {
    lines.push(
      `| ${method.method} | ${method.passFullCount} | ${method.passPartialCount} | ${method.failMissCount} |`,
    );
  }

  lines.push(
    '',
    '## Cross-Method Comparison',
    '',
    '| Case ID | Keyword Outcome | BM25 Outcome | BM25 vs Keyword R@10 | Top-Ranked Changed | Note |',
    '| --- | --- | --- | --- | --- | --- |',
  );

  for (const comparison of report.crossMethodComparison) {
    lines.push(
      `| ${comparison.caseId} | ${comparison.keywordOutcome} | ${comparison.bm25Outcome} | ${comparison.bm25VsKeywordRecallAt10} | ${comparison.bm25ChangedTopRankedFiles ? 'yes' : 'no'} | ${comparison.note} |`,
    );
  }

  const caseIds = [...new Set(report.methods.flatMap((method) => method.cases.map((item) => item.caseId)))];
  for (const caseId of caseIds) {
    const methodCases = report.methods
      .map((method) => ({
        method: method.method,
        caseResult: method.cases.find((item) => item.caseId === caseId),
      }))
      .filter((item) => item.caseResult);
    const repo = methodCases[0]?.caseResult?.repo ?? 'unknown';

    lines.push('', `## ${caseId}`, '', `Repo: \`${repo}\``, '');
    lines.push('| Method | Outcome | R@10 | P@10 | F1@10 | Categories |');
    lines.push('| --- | --- | ---: | ---: | ---: | --- |');

    for (const entry of methodCases) {
      const caseResult = entry.caseResult!;
      lines.push(
        `| ${entry.method} | ${caseResult.outcome} | ${caseResult.recallAt10.toFixed(4)} | ${caseResult.precisionAt10.toFixed(4)} | ${caseResult.f1At10.toFixed(4)} | ${caseResult.observedFailureCategories.length === 0 ? 'None' : caseResult.observedFailureCategories.join(', ')} |`,
      );
      lines.push('');
      lines.push(`- ${entry.method} hit files: ${caseResult.hitGroundTruthFiles.length === 0 ? 'None' : caseResult.hitGroundTruthFiles.join(', ')}`);
      lines.push(`- ${entry.method} missed files: ${caseResult.missedGroundTruthFiles.length === 0 ? 'None' : caseResult.missedGroundTruthFiles.join(', ')}`);
      lines.push(`- ${entry.method} unexpected files: ${caseResult.unexpectedTopKFiles.length === 0 ? 'None' : caseResult.unexpectedTopKFiles.join(', ')}`);
      lines.push(`- ${entry.method} explanation: ${caseResult.observedExplanation}`);
      lines.push(`- ${entry.method} future hypotheses:`);
      if (caseResult.hypothesesForFutureEvaluation.length === 0) {
        lines.push('  - None');
      } else {
        for (const hypothesis of caseResult.hypothesesForFutureEvaluation) {
          lines.push(`  - [${hypothesis.needsEvidenceFrom}] ${hypothesis.hypothesis}`);
        }
      }
      lines.push('');
    }
  }

  lines.push(
    '## Implications',
    '',
    '- BM25 tie with keyword supports evaluating real vector-only retrieval next.',
    '- Zero-hit cases remain candidates for semantic retrieval testing.',
    '- Review burden remains necessary because PASS_FULL can still retrieve many non-ground-truth files.',
    '',
    '## Warnings',
    '',
  );

  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}
