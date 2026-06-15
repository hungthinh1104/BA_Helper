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

If a command is skipped, write the reason in the demo notes before publishing.
Run DB-backed suites sequentially; `pnpm test:e2e` and `pnpm demo:golden-path`
both reset/use the isolated test database and should not be launched in
parallel.

## Known Limits To State

- Scanner pilots are bounded static extractors.
- Unsupported patterns become diagnostics, `UNKNOWN`, or `RISK`.
- There is no claim of full semantic compiler-level analysis.
- LLM output is constrained by extracted evidence and human review.
- Automated CI verification uses fake providers; the manual public demo uses Gemini real LLM with a configured API key.

## Phase 48A Freeze Result

Verdict: `READY`

Validated sequentially on the Phase 48A freeze pass:

```text
pnpm typecheck          PASS
pnpm run test:analyzer  PASS
pnpm test               PASS
pnpm lint               PASS
pnpm test:e2e           PASS
pnpm demo:golden-path   PASS
```

Operational note:

```text
Do not run DB-backed suites in parallel. `pnpm test:e2e` and
`pnpm demo:golden-path` both reset/use the isolated test database.
```
