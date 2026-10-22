# Public Demo Checklist

Use this checklist before publishing a portfolio walkthrough or recording a live demo.

## Story

- [x] Position BA Helper as a Requirement-to-Code Impact Analyzer.
- [x] Lead with the TypeScript/NestJS booking cancellation/refund flow.
- [x] Explain the path: requirement change -> impacted backend code -> evidence -> unknowns/risks -> QA scenarios -> human review -> traceability report.
- [x] Present multi-language support as bounded capability proof, not the main demo story.
- [x] Avoid repo chatbot, generic AI coding agent, or code generator framing.

## Scanner Maturity

- [x] Explain `STABLE`: TypeScript/NestJS, strongest public demo path.
- [x] Explain `PARTIAL`: Java/Spring Boot, useful bounded extraction with known limitations.
- [x] Explain `EXPERIMENTAL`: Go, Python, C#, PHP, and Ruby pilot adapters.
- [x] State that unsupported patterns become diagnostics, `UNKNOWN`, or `RISK`.
- [x] Do not claim production-grade multi-language semantic analysis.

## Demo Flow

- [x] Run `pnpm demo:golden-path`.
- [x] Show the sample requirement change.
- [x] Show impacted artifacts with evidence.
- [x] Show unknowns/risks and QA scenarios.
- [x] Show human review before finalization.
- [x] Show the finalized traceability report.
- [x] Mention drift/freshness checks as snapshot safety.

## Public Wording

- [x] Use: bounded, evidence-backed, deterministic, experimental, manual review required.
- [x] Avoid: perfectly, fully supports, seamless, production-ready multi-language scanner.
- [x] Keep LLM claims constrained: the model structures evidence-backed findings, but it is not the source of truth.

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm run test:analyzer`
- [x] `pnpm test`
- [x] `pnpm lint`
- [x] `pnpm test:e2e`
- [x] `pnpm demo:golden-path`
- [x] `pnpm demo:multi-repo-golden-path`

If a command is skipped, write the reason in the demo notes before publishing.
Run DB-backed suites sequentially; `pnpm test:e2e` and `pnpm demo:golden-path`
both reset/use the isolated test database and should not be launched in
parallel. The multi-repo golden path follows the same rule.

## Known Limits To State

- Scanner pilots are bounded static extractors.
- Unsupported patterns become diagnostics, `UNKNOWN`, or `RISK`.
- There is no claim of full semantic compiler-level analysis.
- LLM output is constrained by extracted evidence and human review.
- Automated CI verification uses fake providers; the manual public demo uses Gemini real LLM with a configured API key.

## Previous Phase 48A Freeze Record (Historical)

Recorded verdict: `READY`. This legacy note has no pinned commit or execution
date and is not a current release decision. Use the
[roadmap status](../release/roadmap-status.md) and its linked evidence for
current gates.

The following commands were recorded as passing on that freeze pass; they have
not been revalidated by this checklist update:

```text
pnpm typecheck          PASS
pnpm run test:analyzer  PASS
pnpm test               PASS
pnpm lint               PASS
pnpm test:e2e           PASS
pnpm demo:golden-path   PASS
pnpm demo:multi-repo-golden-path PASS
```

Operational note:

```text
Do not run DB-backed suites in parallel. `pnpm test:e2e` and
`pnpm demo:golden-path` both reset/use the isolated test database.
`pnpm demo:multi-repo-golden-path` must also run separately.
```

Current visual asset status: the diagrams in the text proof pack are available;
the screenshot assets listed in the capture checklist are not checked in.
