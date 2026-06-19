# Metrics v0

Generated at: 2026-06-19T06:21:52.263Z

Changed files are proxy ground truth.
File-level only.
Keyword baseline is deterministic and does not use DB, embeddings, LLM, or HybridRetrievalService.
High review burden means humans must inspect many retrieved files per true positive.
If a case has zero true positives, burden is treated as all retrieved files being wasted review effort.

| Method | Aggregate | Cases | R@5 | R@10 | P@5 | P@10 | F1@5 | F1@10 | ReviewBurden@5 | ReviewBurden@10 | NoHitCases@10 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| keyword-baseline-v0 | E2E all cases | 6 | 0.5139 | 0.5555 | 0.4167 | 0.3869 | 0.4397 | 0.4212 | 1.1945 | 1.4583 | 2 |
| keyword-baseline-v0 | Clean retrieval subset | 5 | 0.4167 | 0.4667 | 0.3000 | 0.2643 | 0.3276 | 0.3054 | 1.2333 | 1.5500 | 2 |
| bm25-baseline-v0 | E2E all cases | 6 | 0.5139 | 0.5555 | 0.4167 | 0.3869 | 0.4397 | 0.4212 | 1.1945 | 1.4583 | 2 |
| bm25-baseline-v0 | Clean retrieval subset | 5 | 0.4167 | 0.4667 | 0.3000 | 0.2643 | 0.3276 | 0.3054 | 1.2333 | 1.5500 | 2 |

| Case ID | Method | R@10 | P@10 | F1@10 | Hits | Missed Files |
| --- | --- | ---: | ---: | ---: | --- | --- |
| reqimpact-case-001-backend-reliability-semantics | keyword-baseline-v0 | 0.0000 | 0.0000 | 0.0000 | 0 | apps/api/prisma/schema.prisma<br>apps/api/src/modules/document/api/document.mapper.ts<br>apps/api/src/modules/document/application/approved-report-projection.service.ts<br>apps/api/src/modules/document/domain/approved-report-metadata.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts<br>apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts<br>packages/contracts/src/document.contract.ts<br>packages/contracts/src/review-queue.contract.ts |
| reqimpact-case-002-realworld-article-author-relation | keyword-baseline-v0 | 0.3333 | 0.5000 | 0.4000 | 2 | src/profile/profile.controller.ts<br>src/profile/profile.service.ts<br>src/user/user.entity.ts<br>src/user/user.service.ts |
| reqimpact-case-003-realworld-auth-middleware-user-object | keyword-baseline-v0 | 1.0000 | 0.5714 | 0.7272 | 4 | None |
| reqimpact-case-004-nest-post-sse-empty-response | keyword-baseline-v0 | 1.0000 | 0.2500 | 0.4000 | 2 | None |
| reqimpact-case-005-realworld-proper-error-object | keyword-baseline-v0 | 0.0000 | 0.0000 | 0.0000 | 0 | src/shared/pipes/validation.pipe.ts<br>src/user/user.controller.ts<br>src/user/user.entity.ts |
| reqimpact-case-006-squareboat-default-includes | keyword-baseline-v0 | 1.0000 | 1.0000 | 1.0000 | 1 | None |
| reqimpact-case-001-backend-reliability-semantics | bm25-baseline-v0 | 0.0000 | 0.0000 | 0.0000 | 0 | apps/api/prisma/schema.prisma<br>apps/api/src/modules/document/api/document.mapper.ts<br>apps/api/src/modules/document/application/approved-report-projection.service.ts<br>apps/api/src/modules/document/domain/approved-report-metadata.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts<br>apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts<br>packages/contracts/src/document.contract.ts<br>packages/contracts/src/review-queue.contract.ts |
| reqimpact-case-002-realworld-article-author-relation | bm25-baseline-v0 | 0.3333 | 0.5000 | 0.4000 | 2 | src/profile/profile.controller.ts<br>src/profile/profile.service.ts<br>src/user/user.entity.ts<br>src/user/user.service.ts |
| reqimpact-case-003-realworld-auth-middleware-user-object | bm25-baseline-v0 | 1.0000 | 0.5714 | 0.7272 | 4 | None |
| reqimpact-case-004-nest-post-sse-empty-response | bm25-baseline-v0 | 1.0000 | 0.2500 | 0.4000 | 2 | None |
| reqimpact-case-005-realworld-proper-error-object | bm25-baseline-v0 | 0.0000 | 0.0000 | 0.0000 | 0 | src/shared/pipes/validation.pipe.ts<br>src/user/user.controller.ts<br>src/user/user.entity.ts |
| reqimpact-case-006-squareboat-default-includes | bm25-baseline-v0 | 1.0000 | 1.0000 | 1.0000 | 1 | None |

## Warnings

- Changed files are proxy ground truth, not absolute impacted files.
- Metrics are file-level only, not method-level.
- Clean retrieval aggregate excludes scanner coverage failure case(s): reqimpact-case-006-squareboat-default-includes.
- E2E aggregate includes all cases, including scanner coverage failures.
- Included benchmark result: keyword-baseline.v0.json
- Included benchmark result: bm25-baseline.v0.json
- Excluded non-benchmark result file: rag-samples.v0.json
- Excluded non-benchmark result file: results.v0.json
- Excluded non-benchmark result file: metrics.v0.json
- Excluded non-benchmark result file: failure-analysis.v0.json
- Optional result file present but excluded until explicitly supported: rag-samples.current-hybrid.v0.json
- Optional result file not found: vector-baseline.v0.json
