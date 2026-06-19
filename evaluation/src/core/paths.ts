export const EvaluationPaths = {
  // Current paths used for migrating backwards-compatibility if needed
  datasetLegacy: {
    cases: 'evaluation/datasets/cases.v0.json',
    schema: 'evaluation/datasets/cases.v0.schema.json',
    notes: 'evaluation/datasets/case-selection-notes.v0.md',
    snapshotOverrides: 'evaluation/datasets/case-snapshot-overrides.v0.json',
  },
  
  datasetV0: {
    cases: 'evaluation/datasets/v0/cases.v0.json',
    schema: 'evaluation/datasets/v0/cases.v0.schema.json',
    notes: 'evaluation/datasets/v0/case-selection-notes.v0.md',
    snapshotOverrides: 'evaluation/datasets/v0/case-snapshot-overrides.v0.json',
  },
  
  resultsV0: {
    manifests: 'evaluation/results/v0/manifests',
    probes: 'evaluation/results/v0/probes',
    alignment: 'evaluation/results/v0/alignment',
    baselines: 'evaluation/results/v0/baselines',
    samples: {
      root: 'evaluation/results/v0/samples',
      currentHybrid: 'evaluation/results/v0/samples/current-hybrid',
      vectorOnly: 'evaluation/results/v0/samples/vector-only',
    },
    analysis: 'evaluation/results/v0/analysis',
    runbooks: 'evaluation/results/v0/runbooks',
    runs: 'evaluation/results/v0/runs',
    errors: 'evaluation/results/v0/errors',
  },

  resultsLegacy: {
    root: 'evaluation/results',
    probes: {
      dbReadinessJson: 'evaluation/results/db-snapshot-readiness.v0.json',
      dbReadinessMd: 'evaluation/results/db-snapshot-readiness.v0.md',
      vectorBaselinePathJson: 'evaluation/results/vector-baseline-path.v0.json',
      vectorBaselinePathMd: 'evaluation/results/vector-baseline-path.v0.md',
    },
    alignment: {
      alignmentJson: 'evaluation/results/case-snapshot-alignment.v0.json',
      alignmentMd: 'evaluation/results/case-snapshot-alignment.v0.md',
    },
    baselines: {
      keywordJson: 'evaluation/results/keyword-baseline.v0.json',
      keywordMd: 'evaluation/results/keyword-baseline.v0.md',
      bm25Json: 'evaluation/results/bm25-baseline.v0.json',
      bm25Md: 'evaluation/results/bm25-baseline.v0.md',
      vectorJson: 'evaluation/results/vector-baseline.v0.json',
    },
    samples: {
      currentHybridJson: 'evaluation/results/rag-samples.current-hybrid.v0.json',
      currentHybridMd: 'evaluation/results/rag-samples.current-hybrid.v0.md',
      ragSamplesJson: 'evaluation/results/rag-samples.v0.json',
      ragSamplesMd: 'evaluation/results/rag-samples.v0.md',
    },
    analysis: {
      metricsJson: 'evaluation/results/metrics.v0.json',
      metricsMd: 'evaluation/results/metrics.v0.md',
      failuresJson: 'evaluation/results/failure-analysis.v0.json',
      failuresMd: 'evaluation/results/failure-analysis.v0.md',
      summaryMd: 'evaluation/results/research-summary.v0.md',
    }
  }
};
