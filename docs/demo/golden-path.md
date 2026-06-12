# Golden Path Demo

## What this demo proves
This demo is the definitive automated integration test for the focused TypeScript/NestJS Requirement-to-Code Impact Analyzer path. It validates:

```text
scan → impact analysis → evidence → review → report → drift visibility
```

*For a high-level visual representation of this flow, see the [Visual Proof Pack](visual-proof-pack.md).*

Specifically, it demonstrates:
1. **Repository scanning**: creating a snapshot and gathering scan health diagnostics.
2. **Impact analysis**: evaluating a requirement change against the parsed repository to surface risks, unknowns, QA scenarios, and explicit evidence using the `booking@0.1.0` domain pack.
3. **Human review**: simulating reviewer confirmation of insights and ensuring only evidenced claims pass.
4. **Report finalization**: ensuring reports contain traceability matrices and evidence appendices without raw vector leakage.
5. **Drift visibility**: proving that APIs can differentiate between two snapshot versions and flag `STALE_ARTIFACTS`.

## Command to run
To execute the golden path demo deterministically in a local environment:

```bash
pnpm test tests/demo/golden-path-demo.spec.ts
```

*Note: If you have made docs-only changes, you do not need to run the full test suite.*

## Expected Outputs & Diagnostics
When the test runs successfully, it asserts that the system properly generates:
- **Expected Diagnostics**: `SCAN_HEALTH`, `INCREMENTAL_SCAN_SUMMARY`, `EMBEDDING_REUSE_PLAN`, and `DOMAIN_PACK_APPLIED`.
- **Expected Report Sections**: `Executive Summary`, `Impact Flow Diagram`, `Impacted Areas` when evidenced impacts exist, `Open Questions / Unknowns`, and `Evidence Appendix` when evidence exists.

## Fixture Used
- **Fixture Repository**: `nestjs-booking-with-payment`
- **Domain Pack**: `booking@0.1.0`
- **Scanner Maturity**: `STABLE` TypeScript/NestJS path

## Mocked Systems
For deterministic CI, we deliberately use mock providers:
- **LLM Provider:** `FakeLlmProvider` is used to prevent real, non-deterministic token usage and external API calls.
- **Embedding Provider:** Fake embeddings generated locally to bypass external semantic search costs.
- **Drift Check:** To prevent heavy load in CI, full snapshot rescans are partially mocked via a smoke-level drift check rather than doing a full duplicate `git clone`.

## Public Limitations
Please be aware of the following:
- TypeScript/NestJS is the strongest scanner path.
- Java Spring support is `PARTIAL`; Go, Python, C#, PHP, and Ruby adapters are `EXPERIMENTAL` capability proofs.
- Pilot adapters are bounded static extractors, not full compiler-level semantic analyzers.
- Unsupported scanner patterns become diagnostics, `UNKNOWN`, or `RISK` items requiring review.
- Domain packs are hints, not evidence.
- Evaluation metrics are internal quality signals, not public benchmarks.
- Golden path uses fake providers for deterministic CI.
- Production SaaS concerns such as GitHub App auth, billing, and hosted multi-tenant deployment are not complete.

## Next manual UI reproduction path
If you wish to test this visually:
1. Spin up the local stack using `pnpm dev` from the root directory.
2. Follow the steps in [Sample Requirement Change](sample-requirement-change.md) against a synced GitHub repository matching the fixture logic.
