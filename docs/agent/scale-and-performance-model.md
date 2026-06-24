# Scale And Performance Model

## Purpose

This document defines the current scale baseline and performance budgets for
repository scan, impact analysis, retrieval, document generation, and workspace
rendering. It is a planning model, not a broad optimization project.

## Current Scale Envelope

The MVP is sized for public NestJS TypeScript repositories in the Booking /
Payment / Refund vertical slice.

Baseline repository envelope:

```text
source bytes scanned      <= 100 MB
total files considered    <= 10,000
TypeScript parser files   <= 2,000
single selected file      <= 1 MB
clone timeout             <= 60 seconds
static scan timeout       <= 120 seconds
```

Repositories above these limits should produce explicit skipped-input coverage
or failed scan state, not silent partial confidence.

## Pipeline Budgets

Repository ingestion and scan:

- target p50: under 30 seconds for fixture-sized repositories
- target p95: under 120 seconds within the configured scan envelope
- hard guard: fail or mark partial when file, byte, or timeout limits are hit
- no package install, test execution, or repo script execution

Impact analysis:

- target p50: under 45 seconds after a usable snapshot exists
- target p95: under 180 seconds for bounded retrieval and one LLM reasoning call
- evidence sent to the LLM is capped by item and character budgets
- lifecycle completion must not depend on frontend polling inference

Retrieval:

- default retrieval request budget: `maxResults=20`
- LLM evidence pack budget: up to 12 evidence candidates and 30,000 evidence
  characters
- vector/RAG queries must remain snapshot-scoped and project-scoped
- future metrics should split lexical, graph, vector, and rerank time

Worker queue:

- target p50 wait: under 10 seconds in local/single-worker MVP
- target p95 wait: under 60 seconds under demo load
- retryable jobs must be idempotent and keyed by persisted command/job identity
- queue processors call application use cases and do not own business logic

Report generation:

- target p50: under 10 seconds for approved Markdown generation
- target p95: under 30 seconds for MVP-sized reports
- no active LLM call during final report document generation
- report section sizes should stay bounded by persisted read-model/report
  builders before adding richer exports

Frontend workspace:

- initial analysis workspace render target: under 1 second after read-model data
  is available
- large lists should be tab-scoped and rendered from the backend presentation
  contract
- frontend must not reconstruct business state from raw backend records
- future large-analysis work should add virtualization or pagination before
  increasing card counts substantially

## Guardrail Constants

Existing guardrails:

```text
MAX_REPO_SIZE_MB=100
MAX_FILE_COUNT=10000
MAX_TS_FILE_COUNT=2000
MAX_FILE_SIZE_KB=1024
CLONE_TIMEOUT_MS=60000
SCAN_TIMEOUT_MS=120000
retrieval maxResults=20
MAX_EVIDENCE_ITEMS_FOR_LLM=12
MAX_TOTAL_EVIDENCE_CHARS=30000
artifact excerpt policy limit=50000 bytes
```

Future constants to centralize before scale-up:

```text
MAX_RETRIEVAL_CANDIDATES
MAX_REPORT_SECTION_ITEMS
MAX_WORKSPACE_CARD_ITEMS
MAX_EVENT_PAYLOAD_BYTES
MAX_DOCUMENT_MARKDOWN_BYTES
```

Do not raise budgets to hide slow behavior. If a limit blocks a real use case,
add a fixture, measure the pipeline stage, and update tests/docs with the new
budget.

## Metrics To Add Later

Add p50/p95 metrics once observability is promoted beyond local demo proof:

- clone duration
- scan enumeration duration
- parser duration by language adapter
- skipped file counts by reason
- retrieval duration by strategy
- evidence candidate count and truncation flag
- LLM provider latency and validation failure count
- queue wait and run duration by job type
- document generation duration and size
- workspace endpoint latency and response size
- frontend render time for each workspace tab

## Known Risks To Track

- Current limits are configured for MVP correctness, not high-throughput SaaS.
- Large reports can still grow with persisted insight/evidence volume until
  section item caps are centralized.
- Queue wait budgets are not yet enforced by monitoring or autoscaling policy.
- Browser rendering has not been load-tested with very large review queues.
- Project/tenant isolation metrics are not yet part of routine performance
  reporting.
