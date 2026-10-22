# Documentation Guide

Use this page to find the maintained source for a topic and distinguish current
guidance from dated records. `AGENTS.md` remains the repository-wide workflow
instruction; [`agent/CONTEXT_INDEX.md`](agent/CONTEXT_INDEX.md) routes coding
tasks to the relevant technical documents.

## Sources of truth

When statements disagree, use this order:

1. Current code, shared contracts, Prisma schema/migrations, and executable
   evaluation definitions.
2. Current engineering guidance under `docs/agent/`.
3. Accepted architecture decisions under `docs/adr/`.
4. Operational and evaluation records, scoped to the exact version, commit, and
   environment they name.
5. Demo and portfolio narratives, which explain the product but do not certify
   behavior or release readiness.

## Document catalog and owners

| Location | Owner role | Purpose and authority |
| --- | --- | --- |
| `docs/agent/` | Engineering | Current architecture, contracts, state, security, analyzer, UI, and testing rules. Update the owning page when behavior changes. |
| `docs/adr/` | Architecture | Decision records. Each record states whether it is accepted, superseded, or historical; it does not replace current implementation guidance. |
| `docs/evaluation/` | Analyzer / product validation | Reproduction commands, fixture scope, labels, metrics, and limitations. Report results only for the recorded tool and input versions. |
| `docs/release/roadmap-status.md` | Release engineering | Current open gates and links to the latest recorded evidence. |
| Dated files in `docs/release/` and `docs/runbooks/` | Release / operations | Historical evidence for the commit, tool, and environment they record, where available. They are not instructions for the current checkout unless explicitly revalidated. |
| Undated files in `docs/runbooks/` | Operations | Current operational procedures; verify commands against package scripts and deployment configuration when changing them. |
| `docs/runbooks/public-github-smoke-*.json` | Operations | Captured sample outputs for the smoke rubric, not live service state or current release evidence. |
| `docs/deploy/` and `docs/deployment/` | Operations | Deployment-specific instructions and readiness checklists. Preview setup and general smoke checks have separate scopes. |
| `docs/demo/` | Product / demo | Local demo steps, sample requirements, and public-demo boundaries. Demo claims must link to current verification or evaluation evidence. |
| `docs/portfolio/` | Product / demo | Narrative material only. Screenshots and other proof assets must exist before they are embedded or described as present. |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md` | Repository maintainers | Public entry points and contribution/security guidance. Keep these concise and link to the canonical detail. |

## Current entry points

- [Engineering task routing](agent/CONTEXT_INDEX.md)
- [Architecture](agent/architecture.md)
- [API contracts](agent/api-contracts.md)
- [Analyzer rules](agent/analyzer-rules.md)
- [Testing strategy](agent/testing-strategy.md)
- [Analyzer and test-trace evaluation](evaluation/static-test-trace.md)
- [Product-validation protocol](evaluation/product-validation.md)
- [Roadmap and release gates](release/roadmap-status.md)
- [Local demo runbook](demo/run-local-demo.md)
- [Controlled-beta operations](runbooks/controlled-beta-operations.md)

## Maintenance rules

- Keep one current owner document per behavior or policy. Other pages should
  link to it instead of copying its contract or status.
- Keep date-specific verification results as history. Record the tested commit,
  tool version, environment, skipped checks, and limits; never label an old
  result “current” or “latest.”
- Update `docs/release/roadmap-status.md` when release gates change. Link to
  dated evidence instead of copying test counts and scorecards into multiple
  pages.
- Keep evaluation labels and reported numbers tied to their immutable inputs
  and analyzer version. A new measurement supplements the record; it does not
  silently rewrite a previous result.
- Mark superseded decisions and link their replacement. Do not delete useful
  historical decisions merely to make the active guidance shorter.
- Check local Markdown links and code commands when editing documentation.
  Missing screenshots must be described as pending, not embedded as broken
  image links.
