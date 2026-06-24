# Agent Context Routing Index

Do not read the entire `docs/` directory by default. Start here, then follow
the narrow route that matches the task.

## Mandatory reading

Read these first for any BA_Helper task:


2. [auth-permissions.md](auth-permissions.md)
3. [api-contracts.md](api-contracts.md)
4. [use-cases.md](use-cases.md)

## Canonical current docs


- `docs/agent/auth-permissions.md`
- `docs/agent/api-contracts.md`
- `docs/agent/use-cases.md`
- `docs/agent/architecture.md`
- `docs/agent/testing-strategy.md`
- `docs/agent/done-checklist.md`
- `docs/agent/security-hardening-model.md`
- `docs/agent/scale-and-performance-model.md`

## Historical docs

- `docs/adr/adr-0008-untrusted-repository-ingestion.md`
- `docs/adr/adr-0009-deploy-workspace-bootstrap.md`

These ADRs are historical records. Prefer current code and current-state docs
if they conflict.

## Task routing

### Auth / RBAC

Read:
- `auth-permissions.md`
- `api-contracts.md`


### Report / export

Read:
- `analysis-invariants.md` — Audit invariants for reviewed report snapshots, review completion gate, final reviewed report export, and failure modes.
- `api-contracts.md`
- `use-cases.md`


### Frontend route gating

Read:
- `auth-permissions.md`
- `api-contracts.md`


### Backend use cases

Read:
- `use-cases.md`
- `architecture.md`
- `input-quality.md`

### Security / hardening

Read:
- `security-hardening-model.md`
- `input-quality.md`
- `ai-rules.md`
- `auth-permissions.md`

### Scale / performance

Read:
- `scale-and-performance-model.md`
- `architecture.md`
- `testing-strategy.md`

### Docs cleanup

Read:

- `done-checklist.md`
- this index

### Demo / release

Read:
- `../demo/walkthrough.md`
- `../demo/public-demo-checklist.md`
- `../deployment/smoke-checklist.md`


### Tests

Read:
- `testing-strategy.md`
- `done-checklist.md`
- `use-cases.md`

## Rules

- Prefer code as the source of truth when docs conflict.
- Keep scope narrow.
- Do not add new product scope from this index.
- Out of scope: private repos, OAuth/GitHub App,
  organizations/teams/invites, merged clarification-loop regeneration, DOCX,
  Jira, and Confluence.
