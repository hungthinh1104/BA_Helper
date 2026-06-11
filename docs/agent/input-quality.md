# Input Quality And Validation

## Principle

```text
Trash in -> explicit rejection or explicit uncertainty.
Never trash in -> confident report.
```

The system stores source input for auditability, but it does not automatically
treat every submitted repository or sentence as analysis-ready input.

## Repository Input Gate

MVP accepts only public GitHub repository URLs:

```text
https://github.com/{owner}/{repository}
```

Validation and normalization rules:

```text
- accept HTTPS GitHub repository URLs only
- reject credentials, query tokens, fragments, non-GitHub hosts, local paths,
  SSH URLs, git:// URLs, IP addresses, and redirect targets outside github.com
- normalize trailing slash and optional `.git` suffix to canonical repository URL
- optional ref must be a branch, tag, or full commit SHA represented as data,
  never shell-interpolated command content
- clone/fetch must execute through safe library arguments, not shell string concatenation
- apply configured limits for clone size, file count, individual file size,
  processing time, and total extracted evidence size
- when a syntactically valid unqualified ref resolves to multiple target
  identities, fail the asynchronous scan with `AMBIGUOUS_REPOSITORY_REF`;
  do not silently choose between a branch and tag with the same name
```

Initial supported source stack:

```text
NestJS TypeScript only
```

Express is a later adapter. A public TypeScript repo is not sufficient unless
the scanner detects the supported NestJS structure needed by the MVP.

Unsupported or invalid repository outcomes:

```text
invalid repository input     -> reject before creating a scan job
unreachable/clone failure    -> ScanJob FAILED, no usable snapshot
ambiguous remote ref         -> ScanJob FAILED with AMBIGUOUS_REPOSITORY_REF, no new target observation/snapshot
unsupported framework        -> ScanJob FAILED with UNSUPPORTED_FRAMEWORK
supported but extraction fails without usable output -> ScanJob FAILED, no snapshot
supported with usable bounded extraction gaps        -> COMPLETED ScanJob and PARTIAL snapshot with coverage report
```

`PARTIAL` must not be used to hide an unsupported framework, transient failed
execution, or an empty unusable result. A snapshot is published only for
usable `READY` or declared `PARTIAL` output.

The ref is a tracked `RepositoryTarget`, not part of snapshot identity. Two
targets may legitimately resolve to the same immutable extracted snapshot;
freshness must be computed against the target selected for the analysis.
Safe source resolution may update a moving target observation even if
subsequent extraction fails, so older output can still be reported as known
stale.

## Change Request Input Gate

Store accepted raw business text exactly for audit, and derive a normalized
text form for retrieval. Never silently rewrite an accepted raw request.
Before persistence, reject requirement text that appears to contain a
credential, token, private key, or connection secret in the MVP. Encrypted
sensitive-requirement storage is outside the current milestone.

For MVP, a change request is analysis-ready only when it contains:

```text
- a non-empty title, stored in the immutable submitted revision
- a requested behavior or change action
- a target business concept/object
- enough text to retrieve candidate code evidence
```

The user does not need to specify every policy detail. Missing policy details
are expected to become `UNKNOWN` or stakeholder questions. For example:

```text
Allow users to cancel paid bookings and receive refund.
```

is analysis-ready even though refund percentage and deadline are unspecified.

Inputs that are not analysis-ready:

```text
"fix it"
"booking"
empty or whitespace-only text
instructions with no business change to evaluate
```

Secret-like requirement input is not merely unready: it is rejected before
revision persistence with `SENSITIVE_REQUIREMENT_INPUT`.

Requirement lifecycle:

```text
DRAFT                    stored but not eligible for impact analysis
READY_FOR_ANALYSIS       passed input gate
NEEDS_CLARIFICATION      rejected by readiness validation with reasons/questions
ARCHIVED                 retained, no new analysis
```

The readiness check returns structured issues, not a fabricated normalized
requirement.

Readiness qualification is not impact reasoning. It may use deterministic
validation and explicit user submission; it must not invent domain policy or
silently rewrite the raw request to make it analyzable.

Changing report-visible title or raw requirement text creates a new immutable
revision. Existing analysis output must never display a later edited title as
though it were part of the original input.

## Cross-Input Compatibility Gate

Impact analysis is accepted only when:

```text
- requirement revision belongs to the same Project as the repository snapshot
- requirement revision status is READY_FOR_ANALYSIS
- a published snapshot is READY, or PARTIAL with explicit acknowledgement
- selected repository target belongs to the snapshot repository and currently
  observes the selected snapshot commit when the analysis is created
- snapshot framework is supported by the requested analyzer adapter
- both source inputs are immutable/versioned for the run
```

Reject mismatched project inputs. Do not create an analysis whose evidence
comes from a repository unrelated to its requirement workspace.

## Sensitive And Hostile Content

Even public repositories may contain secrets or hostile prompt-like text.

Before any future real LLM request:

```text
- redact likely secret material from all selected prompt payloads, including
  requirement text and evidence snippets
- treat code/comments/docs/requirements as untrusted data
- record redaction counts without persisting secret values
- refuse analysis if the evidence set cannot be safely sent under configured policy
```

Persistence policy for the MVP:

```text
- accepted requirement raw text is stored only after secret-input rejection
- persisted evidence excerpts are redacted before storage; keep source locator,
  hash, and redaction metadata rather than a detected secret literal
- temporary checkout retention/cleanup must be defined before scanning
  non-fixture public repositories in a deployed environment
```

Automated tests begin with prompt-like fixture content and deterministic fake
LLM behavior; real-provider safety evaluation is a later gate.
