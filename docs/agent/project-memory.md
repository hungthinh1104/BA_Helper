# Project Direction Memory — Requirement-to-Code Impact Analyzer

## Core identity

This project is not a generic repository chatbot, not a generic AI coding agent, and not a code generation tool.

It is a Requirement-to-Code Impact Analyzer for backend teams.

Given a requirement/change request, the system should identify impacted backend code artifacts, attach explicit evidence, surface unknowns/risks/QA scenarios, support human review, and generate traceability reports.

Core path:

```text
Requirement change
-> impacted code artifacts
-> source evidence
-> unknowns / risks / QA scenarios
-> human review
-> approved traceable report
```

Core value: reduce delivery and regression risk when requirements change.

Do not position the product as "multi-domain", "AI analyzes code", an AI repo
chatbot, an AI coding assistant, an auto-BRD generator, or a code-smell
dashboard. Domain packs and LLMs are support layers for the trust pipeline, not
the product center.

## Product priority

The priority order is:

1. Evidence-backed requirement-to-code impact
2. Unknowns, risks, and QA scenarios that expose missing policy
3. Human review before finalization
4. Traceability/provenance for reports and exports
5. Coverage, scan health, stale/drift warnings
6. Domain and language expansion only after trust foundations are stable

## Main strength so far

The project already has a strong trust layer:

* evidence-backed impact links
* review coverage gate
* matrix row drilldown
* immutable finalized report snapshots
* Markdown/PDF export
* scan health UI
* scan health in reports
* safe scan bounds and skip diagnostics
* TypeScript/NestJS extraction
* Java Spring pilot extraction

## v0.1 Closed Foundations

The following gaps have been closed and are part of the v0.1 foundation:

1. **Scan pipeline atomicity**: snapshots only published when artifacts, edges, evidence, diagnostics, and job linkage persist safely ✅
2. **Evidence quality**: strong source evidence, weak source evidence, structural inference, domain-hint-only support, missing evidence, and conflicting evidence are tracked ✅
3. **Impact precision evaluation**: expected artifact hits, false positives, missing critical artifacts, evidenced insight ratio, unknown quality, and QA usefulness are measured ✅
4. **Review coverage**: deterministic coverage gates with stable IDs, clear reviewed-before-trusted semantics ✅
5. **Report trust UX**: evidenced/inferred/unknown/stale/reviewed/provenance state shown clearly ✅
6. **Drift and re-analysis lifecycle**: stale analysis warnings when old analysis may no longer be trustworthy ✅

## Post-v0.1 Backlog (Do Not Implement Without Explicit Scope)

- Extract infrastructure repository classes from `apps/api` to a shared backend package
- Multi-tenant `organizationId` boundary enforcement
- Private repository OAuth integration
- Scanner maturity gates for non-NestJS frameworks
- Full Java Spring Boot scan parity

## Engineering principle

Use deterministic systems first, LLM second.

The LLM should not invent facts. It should work from extracted artifacts, evidence, retrieval diagnostics, scan health, and domain hints.

If evidence is weak or missing, the output should become an unknown, risk, or review item, not a confident conclusion.

## Scanner principle

Scanner quality is the foundation. If scanner misses important artifacts, retrieval, analysis, and reports become unreliable.

Therefore scanner work should focus on:

* stable artifact keys
* content hashes
* snapshot-scoped extraction
* bounded scan limits
* skip reasons
* scan health diagnostics
* drift comparison
* incremental reuse
* clear PARTIAL/FULL semantics

## Artifact Drift and Snapshot Identity Rules

Snapshot identity and freshness must account for:
`repositoryId`, `commitSha`, `scannerVersion`, `analyzerVersion`, and `profileVersion`.
Scanner/analyzer version changes may make drift counts incompatible.

Artifact Drift constraints:
* Snapshot drift must use exact `artifactKey` matching and artifact-level `contentHash`.
* `Evidence.contentHash` must not be used as a proxy for artifact content changes.
* If artifact-level `contentHash` is unavailable, changed/unchanged drift must be marked unavailable or a migration must add `CodeArtifact.contentHash`.

## Domain scaling principle

Do not scale domains by adding random prompt branches.

Use Domain Packs.

Each domain pack should include:

* glossary
* important entities
* workflow/state-machine terms
* common risk patterns
* QA scenario hints
* retrieval hints
* evaluation cases
* negative examples

Domain packs are hints, not facts. Evidence must still come from code.

Correct hierarchy:

```text
Domain pack = controlled terminology + risk/QA hint layer
Evidence = source of truth
Review = final authority
Provenance = audit boundary for reports
```

Every feature should answer whether it improves evidence, review, provenance,
or risk reduction for BA/QC/Tech Lead users. If not, defer it.

## Evaluation principle

Every new domain or scanner expansion needs evaluation cases.

A good evaluation case contains:

* requirement change
* expected impacted artifacts
* expected evidence
* expected risks
* expected QA scenarios
* expected unknowns
* negative cases

Track:

* recall: did it find the important artifacts?
* precision: did it avoid irrelevant artifacts?
* evidence quality: does evidence support the claim?
* unknown quality: are the questions useful?
* QA usefulness: are scenarios testable?

## Work process rule

Every phase should stay small and testable.

Each phase should have:

* clear goal
* explicit out-of-scope list
* deterministic acceptance criteria
* regression tests
* no scope creep
* honest limitations

Every 3–4 engineering phases, add one validation phase.

---

## Global System Prompt For Future Phases

You are helping me build a Requirement-to-Code Impact Analyzer for backend teams.

Project identity:
This is not a generic repo chatbot, not a generic AI coding agent, and not a code generation tool. The product analyzes requirement/change requests and maps them to impacted backend code artifacts with evidence, risks, QA scenarios, human review, and traceability reports.

Current product direction:
The system should prioritize trust and auditability over broad feature expansion.

Priority order:

1. Evidence-backed requirement-to-code impact
2. Unknowns, risks, and QA scenarios
3. Human review before finalization
4. Traceable provenance for reviewed reports
5. Coverage, scan health, stale/drift warnings
6. Domain and language expansion only after trust foundations are stable

Current architecture assumptions:

* Backend-first system
* Snapshot-scoped repository analysis
* Code artifacts have stable artifact keys and content hashes
* Reports are finalized into immutable snapshots
* Exports should use persisted report snapshots, not recompute live state
* Scan health must be visible when coverage is PARTIAL
* Java Spring support is pilot/partial unless explicitly improved
* TypeScript/NestJS is the primary stronger extraction path

Important engineering principles:

* Deterministic first, LLM second
* No fuzzy/LLM matching when deterministic matching is sufficient
* Do not invent facts without evidence
* If evidence is missing, represent it as unknown/risk/review item
* Do not overclaim FULL support when coverage is PARTIAL
* Do not leak raw source code, raw diagnostics JSON, secrets, or private repository information unnecessarily
* Keep outputs bounded

When reviewing or proposing a phase, always provide:

1. Critical assessment: benefits, risks, possible scope creep
2. Decision: approve, reject, or revise
3. Required corrections
4. Acceptance criteria
5. Test plan
6. Commit message
7. Paste-ready implementation prompt if needed

Near-term roadmap:

1. Harden scan pipeline persistence boundaries
2. Classify evidence quality for impact reports
3. Add impact precision scorecards for golden cases
4. Tighten review coverage gates
5. Improve report trust UX
6. Continue drift/freshness hardening

Domain scaling rule:
Do not add domains by hardcoding many prompt branches. Use Domain Packs containing glossary, entity hints, workflow terms, risk patterns, QA patterns, retrieval hints, evaluation cases, and negative examples. Domain packs are hints only; evidence must still come from code.

Response style:
Be concise in chat, but detailed in implementation prompts. Be critical and precise. Avoid motivational filler. Do not let the project drift into a generic chatbot or AI coding agent.

**Core Mantra**: Evidence, Review, Provenance. Build a traceability-first backend impact analyzer: requirement change → impacted code → evidence → unknowns/risks/QA → human review → immutable report, with scan health, drift, and bounded domain hints keeping the system trustworthy as it scales.
