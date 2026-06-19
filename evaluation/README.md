# ReqImpact Evaluation Workspace

This folder acts as a reproducible research evaluation pipeline for measuring retrieval and impact analysis quality without mixing research scaffolding into the production codebase.

## Scope

The scaffold is intentionally narrow and focuses on evaluating the engine across various baselines against hand-authored dataset cases. 

## Folder layout

```text
evaluation/
  datasets/v0/                 # Hand-authored ground-truth cases
  results/v0/                  # Canonical machine-generated outputs
    manifests/                 # Pipeline state dashboards
    probes/                    # Runtime environment / DB readiness
    alignment/                 # Snapshot mapping
    baselines/                 # Keyword, BM25, etc.
    samples/current-hybrid/    # Production retrieval outputs
    analysis/                  # Metrics and failures
    runbooks/                  # Generated doc exports
  src/
    alignment/                 # Dataset mapping logic
    analysis/                  # Metrics algorithms
    core/                      # Shared paths and I/O helpers
    probes/                    # Readiness checks
    validation/                # Semantic invariant checkers
  baselines/                   # Retrieval algorithm implementations
  scripts/                     # Pipeline executables
```

## Dataset shape

Cases (`datasets/v0/cases.v0.json`) use `candidateArtifacts` to support deterministic offline baselines.

## Commands

Run the full evaluation pipeline (generates canonical paths and legacy aliases):

```bash
pnpm eval:pipeline:v0
```

Individual pipeline stages:

- `eval:probe:db`: Checks DB environment
- `eval:probe:vector-path`: Validates vector settings
- `eval:alignment`: Maps cases to snapshots
- `eval:baseline:keyword`: Runs keyword baseline
- `eval:baseline:bm25`: Runs BM25 baseline
- `eval:samples`: Exports sample current-hybrid results
- `eval:analyze`: Generates failure diagnosis
- `eval:metrics`: Computes R@10, Hit Count, Evidence Coverage. Note: Metrics counts scanner coverage failures from `DATASET_METADATA` by default, which is distinct from actual `DB_ALIGNMENT` database-level indexing coverage. Do not conflate the two.
- `eval:research-summary`: Summarizes findings
- `eval:validate`: Enforces semantic invariants (e10b reproducibility)

## Baselines

- `keyword-baseline`: lexical overlap between requirement text and candidate artifact path/name/excerpt.
- `bm25-baseline`: standard BM25 retrieval over files.
- `vector-only-baseline`: (probed but absent in baseline exports intentionally).
- `current-hybrid`: evaluated via `eval:samples` to export RAG samples using live production components.
