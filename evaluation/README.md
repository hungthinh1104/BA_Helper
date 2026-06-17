# ReqImpact Evaluation Scaffold

This folder turns the product branch into a reproducible research artifact on
`research/reqimpact-eval-v0` without changing the main demo workflow.

## Scope

The scaffold is intentionally narrow:
- dataset cases stored as JSON
- deterministic offline baselines
- metrics computation by command
- manual lane placeholder for pure-LLM comparison

It does not claim benchmark results yet. `cases.v0.json` starts empty on
purpose so no public data is fabricated into the repository.

## Folder layout

```text
evaluation/
  datasets/
    cases.v0.json
    cases.v0.schema.json
  baselines/
    keyword-baseline.ts
    pure-llm-baseline.ts
    vector-only-baseline.ts
  scripts/
    run-evaluation.ts
    compute-metrics.ts
  results/
    results.v0.json
    metrics.v0.md
```

## Dataset shape

Each case follows this base structure:

```json
{
  "id": "case-001",
  "repo": "owner/repo",
  "issueUrl": "https://github.com/owner/repo/issues/123",
  "prUrl": "https://github.com/owner/repo/pull/456",
  "commitSha": "abcdef123456",
  "requirementText": "When a paid booking is cancelled, refund the payment.",
  "groundTruth": {
    "files": ["src/..."],
    "methods": []
  },
  "candidateArtifacts": [
    {
      "artifactKey": "api:booking.cancel",
      "filePath": "src/booking/booking.controller.ts",
      "artifactName": "cancelBooking",
      "excerpt": "..."
    }
  ],
  "notes": "Why these files changed."
}
```

`candidateArtifacts` is optional but strongly recommended for the deterministic
offline baselines. It gives the evaluation scripts a bounded artifact universe
without requiring live repo ingestion during every metric run.

## Commands

Run the scaffold:

```bash
pnpm eval:run
pnpm eval:metrics
```

Explicit paths:

```bash
pnpm eval:run -- --dataset evaluation/datasets/cases.v0.json --results evaluation/results/results.v0.json --markdown evaluation/results/metrics.v0.md
pnpm eval:metrics -- --dataset evaluation/datasets/cases.v0.json --results evaluation/results/results.v0.json
```

## Baselines

- `keyword-baseline`: lexical overlap between requirement text and candidate
  artifact path/name/excerpt.
- `vector-only-baseline`: deterministic sparse token-vector cosine scoring.
- `pure-llm-baseline`: manual lane placeholder, skipped by default to keep the
  scaffold reproducible and CI-safe.

## Current limitation

The scaffold is operational, but benchmark quality depends entirely on adding
real public cases with trustworthy ground truth. That data-collection phase is
the next research task, not something this commit invents locally.
