# Portfolio Proof Pack

## Summary
**BA Helper: Requirement-to-Code Impact Analyzer**

BA Helper is a Requirement-to-Code Impact Analyzer that traces requirement changes to impacted backend artifacts, evidence, risks, QA scenarios, human review, and drift-aware reports.

- **The Problem:** When business requirements change, backend systems are highly susceptible to hidden impacts. Traditional impact analysis relies on manual tribal knowledge, while generic AI chatbots hallucinate answers without repository-wide context or auditable evidence.
- **The Solution:** A deterministic pipeline that maps a requirement change directly to impacted code artifacts. Every claim is strictly backed by parser-extracted code evidence. Machine output is gated by mandatory human review, culminating in an immutable traceability report.
- **The Architecture:** A TypeScript modular monolith built on NestJS, Prisma, PostgreSQL, and pgvector. It features headless static extraction, semantic hybrid retrieval, and a strict state machine to govern the analysis lifecycle.
- **The Trust Model:** An uncompromising evidence hierarchy—if an AI insight cannot be linked to a specific code excerpt, it is flagged as an `UNKNOWN` or `RISK`, never as a fabricated impact.
- **What Makes It Different:** Unlike generic AI coding tools that focus on code generation, this is an impact audit tool. It analyzes frozen commits (snapshots), surfaces scan health bounds, and explicitly warns if the underlying code changes before the review is finalized (Drift Visibility).

## Try it out
You can run the deterministic end-to-end integration test locally without any external LLM keys:
```bash
pnpm demo:golden-path
```

## Demo Script (60–90 Seconds)

1. **Start with Requirement Change:** "We have a new requirement: 'When a paid booking is cancelled, refund the tenant.' Let's see what breaks."
2. **Show Scan/Snapshot:** "First, we securely scan the repository at a frozen commit, extracting artifacts without sending raw code to a public API."
3. **Show Impacted Artifacts:** "The analyzer uses the `booking@0.1.0` domain pack to guide semantic search and surfaces impacted artifacts like `BookingController` and `PaymentService`."
4. **Show Evidence:** "Crucially, every impact is backed by exact code evidence. No hallucination allowed."
5. **Show Risks/QA/Unknowns:** "It also surfaces what it doesn't know, generating QA scenarios like 'Are partial refunds allowed?'"
6. **Show Human Review:** "Machine output isn't final. A human reviewer must confirm or reject these insights."
7. **Show Report:** "Once reviewed, it generates a finalized, immutable traceability report for stakeholders."
8. **Show Drift Warning:** "If a developer pushes a new commit during review, the system detects it and throws a 'Stale Artifact' drift warning, ensuring our report isn't out of date."
9. **Optional Capability Proof:** "The same scanner contract has bounded pilot adapters for other stacks, each labeled with `STABLE`, `PARTIAL`, or `EXPERIMENTAL` maturity so the report does not overclaim support."

## Technical Highlights

The system relies on rigorous backend engineering principles:
- **Stack:** Built using NestJS, Prisma, and PostgreSQL (with pgvector).
- **Scanner & Artifact Model:** Deep AST extraction for TypeScript/NestJS plus bounded pilot adapters with explicit capability metadata.
- **Evidence Hierarchy:** Strict schema constraints enforce that no `EVIDENCED` impact claim exists without an explicit `Evidence` relation.
- **Deterministic Diagnostics:** Bounded metrics like `SCAN_HEALTH`, `INCREMENTAL_SCAN_SUMMARY`, and `DOMAIN_PACK_APPLIED` are fully observable.
- **Evaluation Harness:** Custom test runner that mathematically calculates precision/recall of domain pack retrievals to prevent regression.
- **Embedding Reuse Safety:** Vectors are strictly scoped to specific snapshot commits; leakage between versions is structurally impossible.
- **Domain Pack Registry:** A versioned concept-matching registry that safely falls back to `general@0.0.0` if unsupported packs are requested.
- **Golden Path Integration Test:** A deterministic suite asserting the complete TypeScript/NestJS flow from scan to final report generation.
- **Multi-language Regression Gate:** A deterministic gate proving pilot adapters expose capability summaries, preserve evidence provenance, and turn unsupported patterns into diagnostics rather than fabricated impacts.

## Current Limitations

We are transparent about the project's current maturity:
- **Language Support:** TypeScript/NestJS is the strongest and primary public demo path. Java/Spring Boot is `PARTIAL`; Go, Python, C#, PHP, and Ruby adapters are `EXPERIMENTAL` capability proofs.
- **Scanner Limits:** Pilot adapters are bounded static extractors, not full semantic compiler-level analyzers.
- **Unsupported Patterns:** Unsupported route patterns, scan blind spots, and dependency boundaries become `UNKNOWN`/`RISK` diagnostics that require manual review.
- **Manual Review Required:** LLM output is constrained by evidence and human review; it is not a standalone source of truth.
- **Mocked Execution:** The golden path uses fake providers (`FakeLlmProvider`) for fast, deterministic CI execution without real API costs.
- **Internal Metrics:** Evaluation metrics are internal quality signals tuned to our specific fixtures, not universal public benchmark claims.
- **SaaS Features:** Production SaaS requirements such as GitHub App auth, Stripe billing, and hosted multi-tenant deployment isolation remain incomplete.

## Visual proof assets to include in portfolio

When publishing to a portfolio, include the visual assets curated in the [Visual Proof Pack](visual-proof-pack.md):
- One system architecture diagram (Backend Flow)
- One golden-path state flow (Scan to Report)
- One evidence hierarchy diagram (Trust Model)
- One command execution proof: `pnpm demo:golden-path`
