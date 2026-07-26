# Security Hardening Model

## Purpose

This document defines the current hardening baseline for repository scanning,
AI reasoning, evidence exposure, and report generation. It is a threat model
and operating boundary, not a claim that the product satisfies a production
security review or enterprise deployment requirements.

## Threat Model

Primary untrusted inputs:

- public repository URLs, refs, files, comments, README content, and test data
- requirement titles and raw requirement text
- retrieved evidence excerpts and source locations
- LLM provider output
- queued job payload IDs such as `analysisId` and `documentJobId`

Primary risks:

- repository input attempts to escape the scanner workspace
- repository content attempts to execute code during scan
- binary, generated, vendor, or oversized files exhaust parser resources
- source text contains secrets that could be persisted, logged, embedded, or
  sent to a real LLM provider
- prompt injection text in code comments or requirements tries to control the
  model
- API read models expose Prisma-shaped records or cross-project state
- final report generation accidentally calls a live LLM or reads mutable state
  as if it were reviewed output

## Repository Ingestion Boundary

Repository scanning is static only. The scanner may read files and parse
supported source formats, but it must not execute repository scripts, import
application modules, run package managers, run tests, or follow repository
instructions.

Required ingestion guards:

- accept only validated repository source inputs from the API layer
- use git/library argument arrays, not shell string concatenation
- disable interactive git credential prompts
- clone/fetch with bounded timeouts
- never recurse submodules by default
- skip symlinks instead of following them
- ignore dependency, build, cache, vendor, generated, and known binary/archive
  paths
- enforce file count, TypeScript file count, single-file byte, and total scan
  byte limits
- sniff selected files for binary content before they enter parser paths

Current scanner limits are defined in `packages/analyzer/src/scanner/core/limits.ts`:

```text
MAX_REPO_SIZE_MB=100
MAX_FILE_COUNT=10000
MAX_TS_FILE_COUNT=2000
MAX_FILE_SIZE_KB=1024
CLONE_TIMEOUT_MS=60000
SCAN_TIMEOUT_MS=120000
```

Changing these limits may alter published artifacts, evidence, skipped-input
coverage, and analyzer compatibility. Treat such changes as analyzer-version
impacting unless proven otherwise.

## Secret And Evidence Boundary

Evidence excerpts are untrusted source data. Before persistence, scanner-derived
evidence excerpts pass through the secret redaction layer and store redaction
state. Embedding and real-provider prompt payloads must also pass through AI
redaction policy before external transmission.

The system must not log or expose raw provider prompts, raw provider responses,
detected secret values, or unredacted evidence payloads. Diagnostics may record
counts, IDs, source paths, hashes, or redaction markers, but not secret literals.

Evidence shown in UI and reports remains source text after redaction. It is not
translated, normalized into business prose, or treated as an instruction.

## Prompt Injection Boundary

Code, comments, documentation, evidence, and requirements can contain hostile
instructions. Prompt construction must frame selected repository content as data
to inspect, not instructions to follow.

Model output is not trusted until it passes schema validation and application
integrity checks. An LLM cannot create evidence support by inventing evidence
IDs, artifact keys, certainty labels, or review decisions. `EVIDENCED` claims
must resolve to persisted evidence supplied for the analysis.

## Report Generation Boundary

Final report generation consumes persisted analysis, review, evidence, graph,
and reviewed snapshot state. It must not call an active LLM provider. A final
report can remain completed historical output even when the source target later
makes the analysis stale.

Document jobs are queue execution state. `documentJobId` is not authority by
itself; user-facing access paths must remain scoped through the analysis,
project, and reviewed snapshot ownership model.

## Project And Tenant Isolation

Current MVP scoping expectations:

- requirement revision, repository, snapshot, impact analysis, evidence,
  documents, review items, retrieval queries, and vector chunks are project
  scoped
- RAG queries must filter by tenant/project/repository/snapshot identity
- MVP `tenantId` equals `projectId`
- future tenant identity becomes organization identity

Known risk: the MVP still has dev/single-user assumptions in parts of the stack.
Do not claim full production authorization coverage until project-scoped auth
guards and negative cross-project tests cover every user-facing endpoint and
queued read/write path.

## Event Log Semantics

Audit events capture meaningful lifecycle and domain changes such as scan
completion, artifact extraction, analysis state changes, review decisions, and
document generation. Event payloads should include IDs, counts, state names, and
safe metadata. They must not include raw source excerpts, secret literals, raw
LLM prompts, raw provider responses, or unbounded diagnostic blobs.

## Public Beta Rate Limit Boundary

The API applies a Redis-backed, cross-process public beta rate limit to login
and expensive or sensitive
mutating/download actions such as dev-login, scan creation, requirement/revision
creation, impact analysis creation, report finalization, and report export.
The limiter scopes by authenticated user and project when project context is
available, and by anonymous network scope for explicitly rate-limited public
endpoints such as login and dev-login. Redis keys use a hash of the request
scope, method, project, and route; raw email addresses, IP addresses, request
bodies, and credentials are not stored in limiter keys.

Rules:

```text
Health/bootstrap/read-model GET endpoints remain exempt.
Rate-limit errors use stable code RATE_LIMITED and do not include raw request bodies.
Rate limiting is an abuse guard, not a replacement for production tenant isolation.
Production requires Redis availability for the limiter and queue runtime.
Deploys should override PUBLIC_BETA_RATE_LIMIT_MAX and
PUBLIC_BETA_RATE_LIMIT_WINDOW_MS according to environment capacity.
```

## Scanner Workspace Retention Boundary

Scanner checkouts are temporary execution state, not persisted product data.
The scanner removes the temp workspace after successful and failed clone/scan
execution. Persisted artifacts, dependency edges, evidence, snapshots, reports,
and audit events are never deleted by this cleanup path.

Debug preservation is opt-in only:

```text
BA_HELPER_PRESERVE_SCAN_WORKSPACE=true
```

Cleanup diagnostics may record whether cleanup was attempted, succeeded,
failed, or was intentionally preserved. They use a hashed workspace id and must
not log raw private local checkout paths.

## Public Beta Operations Health Boundary

The system health endpoint may expose backend-authored operational summaries
needed to run a controlled beta:

```text
- database/pgvector connectivity
- Redis/queue connectivity
- pending/running/failed scan job counts
- pending/running/failed impact-analysis job counts
- pending/running/failed document job counts
```

The health response must remain aggregate-only. It must not include queue job
payloads, source excerpts, requirement text, prompt text, secrets, repository
checkout paths, or raw provider responses.

## Known Risks To Track

- Full production auth and organization-level tenant isolation are not complete
  in the MVP.
- Rate limiting and abuse throttling are public beta guardrails, not full
  production abuse prevention.
- Debug-preserved scanner workspaces require manual cleanup and should not be
  enabled in public beta production deployments.
- Real-provider LLM smoke tests are opt-in and do not replace a dedicated safety
  evaluation suite.
