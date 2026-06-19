# Failure Analysis v0 — Lexical Baselines

Generated at: 2026-06-19T06:21:52.721Z

This analyzes deterministic lexical baselines only.
Changed files are proxy ground truth.
File-level only.
No vector, graph, DB, LLM, or R1 behavior is evaluated.

## Method Summary

| Method | PASS_FULL | PASS_PARTIAL | FAIL_MISS |
| --- | ---: | ---: | ---: |
| keyword-baseline-v0 | 3 | 1 | 2 |
| bm25-baseline-v0 | 3 | 1 | 2 |

## Cross-Method Comparison

| Case ID | Keyword Outcome | BM25 Outcome | BM25 vs Keyword R@10 | Top-Ranked Changed | Note |
| --- | --- | --- | --- | --- | --- |
| reqimpact-case-001-backend-reliability-semantics | FAIL_MISS | FAIL_MISS | TIED | no | BM25 tied keyword at R@10 and preserved the same top-ranked file set/order. |
| reqimpact-case-002-realworld-article-author-relation | PASS_PARTIAL | PASS_PARTIAL | TIED | no | BM25 tied keyword at R@10 and preserved the same top-ranked file set/order. |
| reqimpact-case-003-realworld-auth-middleware-user-object | PASS_FULL | PASS_FULL | TIED | yes | BM25 tied keyword at R@10 but changed the top-ranked file order. |
| reqimpact-case-004-nest-post-sse-empty-response | PASS_FULL | PASS_FULL | TIED | yes | BM25 tied keyword at R@10 but changed the top-ranked file order. |
| reqimpact-case-005-realworld-proper-error-object | FAIL_MISS | FAIL_MISS | TIED | no | BM25 tied keyword at R@10 and preserved the same top-ranked file set/order. |
| reqimpact-case-006-squareboat-default-includes | PASS_FULL | PASS_FULL | TIED | no | BM25 tied keyword at R@10 and preserved the same top-ranked file set/order. |

## reqimpact-case-001-backend-reliability-semantics

Repo: `hungthinh1104/BA_Helper`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | FAIL_MISS | 0.0000 | 0.0000 | 0.0000 | LEXICAL_MISMATCH, DATA_MODEL_MISSED |

- keyword-baseline-v0 hit files: None
- keyword-baseline-v0 missed files: apps/api/prisma/schema.prisma, apps/api/src/modules/document/api/document.mapper.ts, apps/api/src/modules/document/application/approved-report-projection.service.ts, apps/api/src/modules/document/domain/approved-report-metadata.ts, apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts, apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts, packages/contracts/src/document.contract.ts, packages/contracts/src/review-queue.contract.ts
- keyword-baseline-v0 unexpected files: None
- keyword-baseline-v0 explanation: No candidate artifact achieved lexical overlap with the requirement text, so every proxy ground-truth file was missed.
- keyword-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.

| bm25-baseline-v0 | FAIL_MISS | 0.0000 | 0.0000 | 0.0000 | LEXICAL_MISMATCH, DATA_MODEL_MISSED |

- bm25-baseline-v0 hit files: None
- bm25-baseline-v0 missed files: apps/api/prisma/schema.prisma, apps/api/src/modules/document/api/document.mapper.ts, apps/api/src/modules/document/application/approved-report-projection.service.ts, apps/api/src/modules/document/domain/approved-report-metadata.ts, apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts, apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts, packages/contracts/src/document.contract.ts, packages/contracts/src/review-queue.contract.ts
- bm25-baseline-v0 unexpected files: None
- bm25-baseline-v0 explanation: No candidate artifact achieved lexical overlap with the requirement text, so every proxy ground-truth file was missed.
- bm25-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.


## reqimpact-case-002-realworld-article-author-relation

Repo: `lujakob/nestjs-realworld-example-app`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | PASS_PARTIAL | 0.3333 | 0.5000 | 0.4000 | SUPPORT_FILE_OVER_RETRIEVED, DATA_MODEL_MISSED, DOMAIN_ALIAS_MISSING, INDIRECT_DEPENDENCY_MISSED |

- keyword-baseline-v0 hit files: src/article/article.entity.ts, src/article/article.service.ts
- keyword-baseline-v0 missed files: src/profile/profile.controller.ts, src/profile/profile.service.ts, src/user/user.entity.ts, src/user/user.service.ts
- keyword-baseline-v0 unexpected files: src/article/article.controller.ts, src/article/comment.entity.ts
- keyword-baseline-v0 explanation: Lexical ranking retrieved 2 ground-truth file(s). It still missed 4 ground-truth file(s). Top-10 also included 2 non-ground-truth file(s). Top ranked files were: src/article/article.controller.ts, src/article/article.entity.ts, src/article/article.service.ts.
- keyword-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.
  - [CURRENT_HYBRID] Hybrid retrieval may recover indirect dependency files if structural evidence links them to the retrieved direct hits.
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

| bm25-baseline-v0 | PASS_PARTIAL | 0.3333 | 0.5000 | 0.4000 | SUPPORT_FILE_OVER_RETRIEVED, DATA_MODEL_MISSED, DOMAIN_ALIAS_MISSING, INDIRECT_DEPENDENCY_MISSED |

- bm25-baseline-v0 hit files: src/article/article.entity.ts, src/article/article.service.ts
- bm25-baseline-v0 missed files: src/profile/profile.controller.ts, src/profile/profile.service.ts, src/user/user.entity.ts, src/user/user.service.ts
- bm25-baseline-v0 unexpected files: src/article/article.controller.ts, src/article/comment.entity.ts
- bm25-baseline-v0 explanation: Lexical ranking retrieved 2 ground-truth file(s). It still missed 4 ground-truth file(s). Top-10 also included 2 non-ground-truth file(s). Top ranked files were: src/article/article.controller.ts, src/article/article.entity.ts, src/article/article.service.ts.
- bm25-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.
  - [CURRENT_HYBRID] Hybrid retrieval may recover indirect dependency files if structural evidence links them to the retrieved direct hits.
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.


## reqimpact-case-003-realworld-auth-middleware-user-object

Repo: `lujakob/nestjs-realworld-example-app`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | PASS_FULL | 1.0000 | 0.5714 | 0.7272 | None |

- keyword-baseline-v0 hit files: src/user/auth.middleware.ts, src/user/user.controller.ts, src/user/user.decorator.ts, src/user/user.service.ts
- keyword-baseline-v0 missed files: None
- keyword-baseline-v0 unexpected files: src/user/dto/update-user.dto.ts, src/user/user.entity.ts, src/user/user.module.ts
- keyword-baseline-v0 explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- keyword-baseline-v0 future hypotheses:
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

| bm25-baseline-v0 | PASS_FULL | 1.0000 | 0.5714 | 0.7272 | None |

- bm25-baseline-v0 hit files: src/user/auth.middleware.ts, src/user/user.controller.ts, src/user/user.decorator.ts, src/user/user.service.ts
- bm25-baseline-v0 missed files: None
- bm25-baseline-v0 unexpected files: src/user/user.entity.ts, src/user/user.module.ts, src/user/dto/update-user.dto.ts
- bm25-baseline-v0 explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- bm25-baseline-v0 future hypotheses:
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.


## reqimpact-case-004-nest-post-sse-empty-response

Repo: `nestjs/nest`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | PASS_FULL | 1.0000 | 0.2500 | 0.4000 | None |

- keyword-baseline-v0 hit files: integration/nest-application/sse/src/app.controller.ts, packages/core/router/router-response-controller.ts
- keyword-baseline-v0 missed files: None
- keyword-baseline-v0 unexpected files: packages/core/router/sse-stream.ts, integration/nest-application/sse/src/app.module.ts, packages/core/router/router-execution-context.ts, packages/core/router/router-explorer.ts, packages/core/router/router-proxy.ts, packages/core/router/routes-resolver.ts
- keyword-baseline-v0 explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- keyword-baseline-v0 future hypotheses:
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

| bm25-baseline-v0 | PASS_FULL | 1.0000 | 0.2500 | 0.4000 | None |

- bm25-baseline-v0 hit files: integration/nest-application/sse/src/app.controller.ts, packages/core/router/router-response-controller.ts
- bm25-baseline-v0 missed files: None
- bm25-baseline-v0 unexpected files: packages/core/router/sse-stream.ts, integration/nest-application/sse/src/app.module.ts, packages/core/router/router-explorer.ts, packages/core/router/router-proxy.ts, packages/core/router/routes-resolver.ts, packages/core/router/router-execution-context.ts
- bm25-baseline-v0 explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- bm25-baseline-v0 future hypotheses:
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.


## reqimpact-case-005-realworld-proper-error-object

Repo: `lujakob/nestjs-realworld-example-app`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | FAIL_MISS | 0.0000 | 0.0000 | 0.0000 | LEXICAL_MISMATCH, DATA_MODEL_MISSED |

- keyword-baseline-v0 hit files: None
- keyword-baseline-v0 missed files: src/shared/pipes/validation.pipe.ts, src/user/user.controller.ts, src/user/user.entity.ts
- keyword-baseline-v0 unexpected files: None
- keyword-baseline-v0 explanation: No candidate artifact achieved lexical overlap with the requirement text, so every proxy ground-truth file was missed.
- keyword-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.

| bm25-baseline-v0 | FAIL_MISS | 0.0000 | 0.0000 | 0.0000 | LEXICAL_MISMATCH, DATA_MODEL_MISSED |

- bm25-baseline-v0 hit files: None
- bm25-baseline-v0 missed files: src/shared/pipes/validation.pipe.ts, src/user/user.controller.ts, src/user/user.entity.ts
- bm25-baseline-v0 unexpected files: None
- bm25-baseline-v0 explanation: No candidate artifact achieved lexical overlap with the requirement text, so every proxy ground-truth file was missed.
- bm25-baseline-v0 future hypotheses:
  - [VECTOR_BASELINE] A vector-only baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.


## reqimpact-case-006-squareboat-default-includes

Repo: `squareboat/nestjs-boilerplate`

| Method | Outcome | R@10 | P@10 | F1@10 | Categories |
| --- | --- | ---: | ---: | ---: | --- |
| keyword-baseline-v0 | PASS_FULL | 1.0000 | 1.0000 | 1.0000 | SCANNER_MISSING_ARTIFACT |

- keyword-baseline-v0 hit files: libs/boat/src/transformers/transformer.ts
- keyword-baseline-v0 missed files: None
- keyword-baseline-v0 unexpected files: None
- keyword-baseline-v0 explanation: This case is labeled as an end-to-end scanner coverage failure, so retrieval metrics must not be read as clean retrieval-only performance. Lexical ranking retrieved 1 ground-truth file(s). Top ranked files were: libs/boat/src/transformers/transformer.ts.
- keyword-baseline-v0 future hypotheses:
  - [DB_SNAPSHOT] Dataset candidates or snapshot-export completeness should be verified before comparing stronger retrieval methods.
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

| bm25-baseline-v0 | PASS_FULL | 1.0000 | 1.0000 | 1.0000 | SCANNER_MISSING_ARTIFACT |

- bm25-baseline-v0 hit files: libs/boat/src/transformers/transformer.ts
- bm25-baseline-v0 missed files: None
- bm25-baseline-v0 unexpected files: None
- bm25-baseline-v0 explanation: This case is labeled as an end-to-end scanner coverage failure, so retrieval metrics must not be read as clean retrieval-only performance. Lexical ranking retrieved 1 ground-truth file(s). Top ranked files were: libs/boat/src/transformers/transformer.ts.
- bm25-baseline-v0 future hypotheses:
  - [DB_SNAPSHOT] Dataset candidates or snapshot-export completeness should be verified before comparing stronger retrieval methods.
  - [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

## Implications

- BM25 tie with keyword supports evaluating real vector-only retrieval next.
- Zero-hit cases remain candidates for semantic retrieval testing.
- Review burden remains necessary because PASS_FULL can still retrieve many non-ground-truth files.

## Warnings

- This analyzes deterministic lexical baselines only.
- Changed files are proxy ground truth.
- File-level only.
- No vector, graph, DB, LLM, or R1 behavior is evaluated.
- BM25 did not improve aggregate file-level retrieval over keyword-baseline-v0 on dataset v0.
- Included benchmark result: keyword-baseline.v0.json
- Included benchmark result: bm25-baseline.v0.json
- Excluded non-benchmark result file: rag-samples.v0.json
- Excluded non-benchmark result file: results.v0.json
- Excluded non-benchmark result file: metrics.v0.json
- Excluded non-benchmark result file: failure-analysis.v0.json
- Optional result file present but excluded until explicitly supported: rag-samples.current-hybrid.v0.json
- Optional result file not found: vector-baseline.v0.json
