# Evaluation Structure Plan

This document outlines the target structure and taxonomy for the evaluation pipeline.

## Principles
1. Hand-authored input must be separate from generated output.
2. All generated results must have a canonical output path under `results/v0/`.
3. Flat result files (e.g. `results/metrics.v0.json`) are legacy aliases only and must not be treated as the source of truth.
4. Legacy aliases are scheduled for removal after E11/E12.
5. All generated results must be written via shared helpers that enforce manifest metadata (`generatedAt`, `runId`, `mode`) and canonical-to-legacy syncing.
6. The `latest.manifest.json` acts as a dashboard tracking the state of research.

## Directory Taxonomy

```text
evaluation/
  README.md
  STRUCTURE_PLAN.md
  datasets/
    v0/                     # Canonical dataset source of truth
  src/
    core/                   # Shared types, I/O, registry, quality logic
    alignment/              # DB vs dataset alignment
    probes/                 # DB snapshot and vector path availability
    analysis/               # Metrics and failure analysis
    validation/             # Result invariant checks
  scripts/                  # CLI wrappers for pipeline steps
  results/
    v0/
      manifests/            # Pipeline state (latest.manifest.json)
      probes/               # Probe outputs
      alignment/            # Alignment outputs
      baselines/            # Baseline run outputs
      samples/              # RAG and hybrid sample outputs
      analysis/             # Metrics outputs
      runbooks/             # Generated documentation/runbooks
```

## Legacy Aliases Map

> **Note:** Legacy flat aliases were retired after canonical v0 artifacts became the source of truth.

- `evaluation/results/db-snapshot-readiness.v0.json` -> `evaluation/results/v0/probes/db-snapshot-readiness.v0.json`
- `evaluation/results/case-snapshot-alignment.v0.json` -> `evaluation/results/v0/alignment/case-snapshot-alignment.v0.json`
- `evaluation/results/rag-samples.current-hybrid.v0.json` -> `evaluation/results/v0/samples/current-hybrid/case006.v0.json`
- `evaluation/results/keyword-baseline.v0.json` -> `evaluation/results/v0/baselines/keyword-baseline.v0.json`
- `evaluation/results/bm25-baseline.v0.json` -> `evaluation/results/v0/baselines/bm25-baseline.v0.json`
- `evaluation/results/metrics.v0.json` -> `evaluation/results/v0/analysis/metrics.v0.json`
- `evaluation/results/failure-analysis.v0.json` -> `evaluation/results/v0/analysis/failure-analysis.v0.json`
- `evaluation/results/research-summary.v0.md` -> `evaluation/results/v0/analysis/research-summary.v0.md`
