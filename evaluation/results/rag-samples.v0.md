# ReqImpact RAG Sample Export v0

- Run ID: rag-sample:case_only:reqimpact-case-001-backend-reliability-semantics:2026-06-17T09-24-38-042Z
- Mode: CASE_ONLY
- Case ID: reqimpact-case-001-backend-reliability-semantics
- Repo: hungthinh1104/BA_Helper

## Requirement Text

fix: harden backend reliability semantics

## Ground Truth Note

Changed files are used here as a practical proxy ground truth. This export does not claim method-level accuracy or final research results.

## Summary

- Top-K count: 10
- Ground-truth hits in top-K: 10
- Recall@K: 0.9091
- Evidence coverage: 0
- Location-only evidence count: 0
- Code-like evidence count: 0

## Top-K

| Rank | File | Type | Kind | Score | Signals | Evidence | Location-only | Code-like | Preview |
| ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| 1 | apps/api/prisma/schema.prisma | SCHEMA_FILE | DATA_MODEL | 0.0000 |  | no | no | no |  |
| 2 | apps/api/src/modules/document/api/document.mapper.ts | MAPPER_FILE |  | 0.0000 |  | no | no | no |  |
| 3 | apps/api/src/modules/document/application/approved-report-projection.service.ts | SERVICE_FILE | DOMAIN_SERVICE | 0.0000 |  | no | no | no |  |
| 4 | apps/api/src/modules/document/domain/approved-report-metadata.ts | TYPE_FILE | DATA_MODEL | 0.0000 |  | no | no | no |  |
| 5 | apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts | USE_CASE_FILE | DOMAIN_SERVICE | 0.0000 |  | no | no | no |  |
| 6 | apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts | USE_CASE_FILE | DOMAIN_SERVICE | 0.0000 |  | no | no | no |  |
| 7 | apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts | USE_CASE_FILE | DOMAIN_SERVICE | 0.0000 |  | no | no | no |  |
| 8 | apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts | USE_CASE_FILE | DOMAIN_SERVICE | 0.0000 |  | no | no | no |  |
| 9 | apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts | MAPPER_FILE |  | 0.0000 |  | no | no | no |  |
| 10 | packages/contracts/src/document.contract.ts | CONTRACT_FILE | DATA_MODEL | 0.0000 |  | no | no | no |  |

## Warnings

- CASE_ONLY mode does not execute retrieval. Candidate artifacts are exported in dataset order only.
- Changed files are proxy ground truth, not absolute truth.
