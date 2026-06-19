# BM25 Baseline v0

Generated at: 2026-06-19T10:17:26.167Z

This is a deterministic BM25 lexical baseline, not vector retrieval.
Changed files are proxy ground truth.
File-level only.

Top K: 10
Average Recall@10 across cases: 0.5555
Total top-10 ground-truth hits: 9

| Case ID | Repo | R@10 | Hit Count | Missed Files |
| --- | --- | ---: | ---: | --- |
| reqimpact-case-001-backend-reliability-semantics | `hungthinh1104/BA_Helper` | 0.0000 | 0 | apps/api/prisma/schema.prisma<br>apps/api/src/modules/document/api/document.mapper.ts<br>apps/api/src/modules/document/application/approved-report-projection.service.ts<br>apps/api/src/modules/document/domain/approved-report-metadata.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts<br>apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts<br>packages/contracts/src/document.contract.ts<br>packages/contracts/src/review-queue.contract.ts |
| reqimpact-case-002-realworld-article-author-relation | `lujakob/nestjs-realworld-example-app` | 0.3333 | 2 | src/profile/profile.controller.ts<br>src/profile/profile.service.ts<br>src/user/user.entity.ts<br>src/user/user.service.ts |
| reqimpact-case-003-realworld-auth-middleware-user-object | `lujakob/nestjs-realworld-example-app` | 1.0000 | 4 | None |
| reqimpact-case-004-nest-post-sse-empty-response | `nestjs/nest` | 1.0000 | 2 | None |
| reqimpact-case-005-realworld-proper-error-object | `lujakob/nestjs-realworld-example-app` | 0.0000 | 0 | src/shared/pipes/validation.pipe.ts<br>src/user/user.controller.ts<br>src/user/user.entity.ts |
| reqimpact-case-006-squareboat-default-includes | `squareboat/nestjs-boilerplate` | 1.0000 | 1 | None |

## Warnings

- BM25 baseline is lexical only; it does not use embeddings, DB, LLM, or HybridRetrievalService.
- Changed files are proxy ground truth.
- File-level only.

## reqimpact-case-001-backend-reliability-semantics

Repo: `hungthinh1104/BA_Helper`

Requirement: fix: harden backend reliability semantics

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| - | No matched artifacts | - | - | 0 | - |

Missed ground-truth files: apps/api/prisma/schema.prisma<br>apps/api/src/modules/document/api/document.mapper.ts<br>apps/api/src/modules/document/application/approved-report-projection.service.ts<br>apps/api/src/modules/document/domain/approved-report-metadata.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts<br>apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts<br>apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts<br>packages/contracts/src/document.contract.ts<br>packages/contracts/src/review-queue.contract.ts

Unexpected top-K files: None


## reqimpact-case-002-realworld-article-author-relation

Repo: `lujakob/nestjs-realworld-example-app`

Requirement: fix: article author relation

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `file:src/article/article.controller.ts` | `src/article/article.controller.ts` | `CONTROLLER_FILE` | 1.5858 | article |
| 2 | `file:src/article/article.entity.ts` | `src/article/article.entity.ts` | `ENTITY_FILE` | 1.5858 | article |
| 3 | `file:src/article/article.service.ts` | `src/article/article.service.ts` | `SERVICE_FILE` | 1.5858 | article |
| 4 | `file:src/article/comment.entity.ts` | `src/article/comment.entity.ts` | `ENTITY_FILE` | 1.2290 | article |

Missed ground-truth files: src/profile/profile.controller.ts<br>src/profile/profile.service.ts<br>src/user/user.entity.ts<br>src/user/user.service.ts

Unexpected top-K files: src/article/article.controller.ts<br>src/article/comment.entity.ts


## reqimpact-case-003-realworld-auth-middleware-user-object

Repo: `lujakob/nestjs-realworld-example-app`

Requirement: fix: auth middleware user object

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `file:src/user/auth.middleware.ts` | `src/user/auth.middleware.ts` | `MIDDLEWARE_FILE` | 6.1084 | auth, middleware, user |
| 2 | `file:src/user/user.decorator.ts` | `src/user/user.decorator.ts` | `DECORATOR_FILE` | 0.3302 | user |
| 3 | `file:src/user/user.controller.ts` | `src/user/user.controller.ts` | `CONTROLLER_FILE` | 0.3239 | user |
| 4 | `file:src/user/user.entity.ts` | `src/user/user.entity.ts` | `ENTITY_FILE` | 0.3239 | user |
| 5 | `file:src/user/user.module.ts` | `src/user/user.module.ts` | `MODULE_FILE` | 0.3239 | user |
| 6 | `file:src/user/user.service.ts` | `src/user/user.service.ts` | `SERVICE_FILE` | 0.3239 | user |
| 7 | `file:src/user/dto/update-user.dto.ts` | `src/user/dto/update-user.dto.ts` | `DTO_FILE` | 0.3148 | user |

Missed ground-truth files: None

Unexpected top-K files: src/user/user.entity.ts<br>src/user/user.module.ts<br>src/user/dto/update-user.dto.ts


## reqimpact-case-004-nest-post-sse-empty-response

Repo: `nestjs/nest`

Requirement: fix(core): post sse endpoint empty response

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `file:packages/core/router/router-response-controller.ts` | `packages/core/router/router-response-controller.ts` | `SERVICE_FILE` | 3.2152 | core, response |
| 2 | `file:integration/nest-application/sse/src/app.controller.ts` | `integration/nest-application/sse/src/app.controller.ts` | `CONTROLLER_FILE` | 2.9642 | sse, endpoint |
| 3 | `file:packages/core/router/sse-stream.ts` | `packages/core/router/sse-stream.ts` | `SERVICE_FILE` | 1.9740 | core, sse |
| 4 | `file:integration/nest-application/sse/src/app.module.ts` | `integration/nest-application/sse/src/app.module.ts` | `MODULE_FILE` | 1.2562 | sse |
| 5 | `file:packages/core/router/router-explorer.ts` | `packages/core/router/router-explorer.ts` | `SERVICE_FILE` | 0.4595 | core |
| 6 | `file:packages/core/router/router-proxy.ts` | `packages/core/router/router-proxy.ts` | `SERVICE_FILE` | 0.4595 | core |
| 7 | `file:packages/core/router/routes-resolver.ts` | `packages/core/router/routes-resolver.ts` | `SERVICE_FILE` | 0.4595 | core |
| 8 | `file:packages/core/router/router-execution-context.ts` | `packages/core/router/router-execution-context.ts` | `SERVICE_FILE` | 0.4392 | core |

Missed ground-truth files: None

Unexpected top-K files: packages/core/router/sse-stream.ts<br>integration/nest-application/sse/src/app.module.ts<br>packages/core/router/router-explorer.ts<br>packages/core/router/router-proxy.ts<br>packages/core/router/routes-resolver.ts<br>packages/core/router/router-execution-context.ts


## reqimpact-case-005-realworld-proper-error-object

Repo: `lujakob/nestjs-realworld-example-app`

Requirement: fix: Return proper error object

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| - | No matched artifacts | - | - | 0 | - |

Missed ground-truth files: src/shared/pipes/validation.pipe.ts<br>src/user/user.controller.ts<br>src/user/user.entity.ts

Unexpected top-K files: None


## reqimpact-case-006-squareboat-default-includes

Repo: `squareboat/nestjs-boilerplate`

Requirement: fix: default includes in transformer class

| Rank | Artifact | File | Type | Score | Matched Tokens |
| ---: | --- | --- | --- | ---: | --- |
| 1 | `file:libs.boat.src.transformers.transformer.ts` | `libs/boat/src/transformers/transformer.ts` | `FILE` | 3.1932 | transformer |

Missed ground-truth files: None

Unexpected top-K files: None

