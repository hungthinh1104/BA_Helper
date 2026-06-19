# CURRENT_HYBRID Export Runbook

## Purpose

This runbook explains how to execute the `CURRENT_HYBRID` research exporter for
ReqImpact on local persisted snapshot data without changing product runtime behavior.

The goal is to observe:
- what current hybrid retrieval returns
- which score channels contributed
- whether evidence looks code-like or location-only
- whether vector signals are actually present

Two modes now exist:

- `CURRENT_HYBRID_SMOKE`
- `CURRENT_HYBRID_BENCHMARK`

## Required local DB state

You need:
- `DATABASE_URL`
- an existing `Project`
- an existing `Repository`
- an existing `RepositorySnapshot`
- existing `CodeArtifact` rows for that snapshot
- ideally existing `EmbeddingChunk` rows if vector behavior is to be observed

If those are missing, benchmark mode must fail clearly and write no misleading
benchmark current-hybrid result files.

## How to find IDs

### Prisma Studio

```bash
pnpm --dir apps/api exec prisma studio --schema prisma/schema.prisma
```

Then inspect:
- `Project`
- `Repository`
- `RepositorySnapshot`

Collect:
- `projectId`
- `repositoryId`
- `snapshotId`

### SQL

You can also inspect by SQL:

```sql
select p.id as project_id, r.id as repository_id, s.id as snapshot_id,
       s.commit_sha, s.coverage_status, s.index_status, s.created_at
from "Project" p
join "Repository" r on r."projectId" = p.id
join "RepositorySnapshot" s on s."repositoryId" = r.id
order by s."createdAt" desc;
```

## Example command

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts \
  --caseId reqimpact-case-001-backend-reliability-semantics \
  --projectId <project-id> \
  --repositoryId <repository-id> \
  --snapshotId <snapshot-id>
```

## Meaning of warnings

- `indexStatus is not VECTOR_READY`
  - vector retrieval may be absent or incomplete
- `No EmbeddingChunk rows exist`
  - vector retrieval cannot actually be evaluated for that snapshot
- `FakeEmbeddingProvider`
  - query embedding is deterministic smoke only, not a real semantic benchmark
- `No VECTOR retrieval signal appeared`
  - current top-k may be lexical/graph-only even though the exporter used the
    current hybrid path

## Verified failure mode

If you invoke `CURRENT_HYBRID` without a usable `DATABASE_URL` in the current
shell, the exporter should fail before any DB read/write with:

```text
CURRENT_HYBRID mode requires DATABASE_URL and existing local DB state.
```

That failure mode was verified for this phase and should not generate
`rag-samples.current-hybrid.v0.json` or `.md`.

## CASE_ONLY vs CURRENT_HYBRID

### CASE_ONLY

- no DB required
- no retrieval executed
- exports dataset candidate artifacts in their current order
- useful for CI-safe structure checks only

### CURRENT_HYBRID_SMOKE

- requires DB state and snapshot IDs
- may call the current `HybridRetrievalService` read-only
- writes smoke-labeled output only
- is not benchmark evidence
- must not write `rag-samples.current-hybrid.v0.json`

### CURRENT_HYBRID_BENCHMARK

- requires DB state and snapshot IDs
- requires `REQIMPACT_ALLOW_REAL_QUERY_EMBEDDING=1`
- requires a real query embedding provider
- requires case/baseSha alignment with the selected snapshot commit
- requires `VECTOR_READY` plus persisted non-fake artifact embeddings
- may write `rag-samples.current-hybrid.v0.json`
- does not tune scoring
- does not write product DB data

## Benchmark guard rules

Benchmark mode is blocked when any of these are true:

- case repo and snapshot repository identity do not match
- `case.baseSha !== snapshot.commitSha`
- `snapshot.indexStatus !== VECTOR_READY`
- no persisted `EmbeddingChunk` rows exist
- artifact embeddings are `fake-embedding` only
- query/artifact embedding profile IDs do not match
- query/artifact providers, models, dimensions, or config hashes do not match
- multiple artifact embedding profiles exist and no explicit artifact profile is selected
- selected artifact profile has zero persisted chunks
- artifact chunks are legacy profile-missing rows
- query provider is fake
- query embedding model is missing
- `REQIMPACT_ALLOW_REAL_QUERY_EMBEDDING` is not set to `1`

## Phase E8/E9 status

Case 006 now has one guarded benchmark-named current-hybrid export:

- case: `reqimpact-case-006-squareboat-default-includes`
- output: `evaluation/results/rag-samples.current-hybrid.v0.json`
- mode: `CURRENT_HYBRID_BENCHMARK`
- query/artifact profile: `google-gemini-001-1536`
- alignment verified: yes

Interpretation limit:

- Case 006 is labeled `E2E_SCANNER_COVERAGE_FAILURE`.
- The changed ground-truth file `libs/boat/src/transformers/transformer.ts`
  was not persisted as a retrievable `CodeArtifact` in the aligned base
  snapshot.
- Current-hybrid Recall@10=0 for this case is therefore an end-to-end scanner
  coverage failure, not a clean retrieval-only miss.

## Why this is not R1

- It does not change artifact representation.
- It does not change hybrid retrieval scoring.
- It does not implement structured embedding.
- Changed files remain proxy ground truth.
The purpose here is observability and guarded benchmark execution, not performance claims without alignment.

## Phase 3B DB readiness probe

Use `evaluation/scripts/probe-db-snapshot-readiness.ts` before attempting any
DB-backed research export.

The probe:

- inspects local DB state read-only when `DATABASE_URL` is available
- reports whether snapshots are usable for future `CURRENT_HYBRID` export
- reports whether snapshots are usable for a future persisted-vector baseline
- does not run retrieval
- does not create `rag-samples.current-hybrid.v0.json`
- does not create `vector-baseline.v0.json`
