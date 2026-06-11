# Auth And Permissions

## Delivery Decision

The backend engine comes first. During the initial fixture-driven development
phase, a documented dev/single-user mode is acceptable.

Auth must not be ignored permanently: requirements, reports, review decisions,
and future private repository data are sensitive.

## Stages

```text
Stage 1: dev/single-user or simple authentication, public repo scan only
Stage 2: project membership and role enforcement for team workspace
Stage 3: private repos, GitHub App/OAuth, encrypted credentials, retention and redaction
```

Do not implement private repository access in the core MVP.

## Role Model

Once multi-user access exists:

```text
OWNER       project/member/repository administration
MAINTAINER  repository and scan operations
ANALYST     requirements and impact analyses
REVIEWER    insight and traceability decisions
VIEWER      read-only access
```

Permissions are backend enforced and project scoped. A frontend-hidden button
is not authorization.

## Audit Requirements

Persist domain events for security- or business-significant actions:

```text
PROJECT_CREATED
REPOSITORY_ADDED
SCAN_STARTED
SCAN_COMPLETED
SCAN_FAILED
REPOSITORY_TARGET_OBSERVED
REQUIREMENT_CREATED
ANALYSIS_STARTED
ANALYSIS_FAILED
INSIGHT_CONFIRMED
INSIGHT_REJECTED
TRACEABILITY_LINK_CONFIRMED
TRACEABILITY_LINK_REJECTED
ANALYSIS_FINALIZED
DOCUMENT_EXPORTED
```

Events record actor identity/type, project or analysis context, timestamp, and
appropriate payload metadata without storing secrets.
