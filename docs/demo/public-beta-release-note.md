# Controlled Beta Release: Requirement-to-Code Impact Analyzer

## 1. What is BA Helper?
BA Helper is a Requirement-to-Code Impact Analyzer designed specifically for backend teams.

## 2. The Problem It Solves
When a business requirement changes, backend systems are highly susceptible to hidden impacts. Traditional impact analysis is manual, relying on tribal knowledge, while generic AI chatbots lack repository-wide context and often hallucinate answers. This tool answers the critical question:
> _If this requirement changes, which backend code paths are likely impacted, what evidence supports that, what is still unknown, and what should QA verify?_

## 3. What the Golden Path Validates
The core pipeline validates a strict, deterministic sequence:
**Scan Health & Snapshot → Impact Analysis (Guided by Domain Packs) → Explicit Evidence Extraction → Human Review Gates → Immutable Traceability Report → Snapshot Drift Visibility**

It ensures that human reviewers are presented with evidence-backed impacted artifacts, bounded QA scenarios, and unknowns, all tied to frozen repository snapshots.

## 4. Trust and Safety Model
This project is built on an unwavering evidence hierarchy:
- **No Evidence Fabrication:** Every claim (`EVIDENCED` impact) must link to a deterministic line-of-code excerpt.
- **Bounded Diagnostics:** Missing support becomes an `UNKNOWN`, `RISK`, or a `QUESTION`. The system does not invent business rules.
- **Reports are Traceability Artifacts:** Machine output is explicitly separated from human finalization; AI never autonomously finalizes a report.

## 5. Evaluation and Quality Checks
We utilize strict internal telemetry (`tests/evaluation/impact-evaluation.spec.ts`) to calculate domain concept matching precision and recall. These are internal quality signals tuned to our specific curated subsets to prevent prompt regressions, not public benchmark claims.

## 6. Current Limitations
We are committed to honest capabilities. As of this controlled beta:
- **TypeScript/NestJS** is the strongest extraction path.
- **Java Spring** support is `PARTIAL`; Go, Python, C#, PHP, and Ruby adapters are `EXPERIMENTAL` capability proofs.
- **Pilot adapters** are bounded static extractors, not full compiler-level semantic analyzers.
- **Unsupported patterns** become diagnostics, `UNKNOWN`, or `RISK` items requiring manual review.
- **Domain packs are hints, not evidence.** They guide retrieval but cannot bypass the evidence hierarchy.
- **Manual UI demo uses Gemini real LLM** when `AI_PROVIDER=google` and a Gemini API key are configured. Automated CI golden-path tests still use fake providers for deterministic, no-network validation.
- **Production SaaS features** (such as GitHub App auth, billing, and hosted multi-tenant deployment) are incomplete.

## 7. How to Run Locally
We designed the setup to be reproducible while supporting real-provider demos. Automated tests can verify the pipeline without an external LLM key; manual UI demos should use Gemini for real LLM output.

```bash
# Clone the repo and install dependencies
pnpm install

# Run type checks
pnpm run typecheck

# Run the complete test suite
pnpm test

# Run the automated deterministic Golden Path Demo
pnpm demo:golden-path
```
For more detailed setup, see the [Golden Path Docs](golden-path.md) and [Sample Requirement](sample-requirement-change.md).

## 8. Next Roadmap
Our immediate focus is hardening pilot scanner adapters while keeping maturity labels explicit, improving visual review flows, and securing multi-user workspace flows in preparation for SaaS deployments.
