# Failure Analysis v0 — Keyword Baseline

Generated at: 2026-06-17T11:15:02.983Z

This analyzes keyword-baseline-v0 only.
Changed files are proxy ground truth.
File-level only.
No vector, graph, DB, LLM, or R1 behavior is evaluated.

## Summary

- PASS_FULL: 2
- PASS_PARTIAL: 1
- FAIL_MISS: 2

| Category | Count |
| --- | ---: |
| DATA_MODEL_MISSED | 3 |
| DOMAIN_ALIAS_MISSING | 1 |
| INDIRECT_DEPENDENCY_MISSED | 1 |
| LEXICAL_MISMATCH | 2 |
| SUPPORT_FILE_OVER_RETRIEVED | 1 |

## reqimpact-case-001-backend-reliability-semantics

- Outcome: FAIL_MISS
- Repo: `hungthinh1104/BA_Helper`
- R@10: 0.0000
- P@10: 0.0000
- F1@10: 0.0000
- Hit files: None
- Missed files: apps/api/prisma/schema.prisma, apps/api/src/modules/document/api/document.mapper.ts, apps/api/src/modules/document/application/approved-report-projection.service.ts, apps/api/src/modules/document/domain/approved-report-metadata.ts, apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase.ts, apps/api/src/modules/impact-analysis/application/review/get-review-queue.usecase.ts, apps/api/src/modules/impact-analysis/infrastructure/impact-analysis.mapper.ts, packages/contracts/src/document.contract.ts, packages/contracts/src/review-queue.contract.ts
- Observed categories: LEXICAL_MISMATCH, DATA_MODEL_MISSED
- Explanation: No candidate artifact achieved keyword overlap with the requirement text, so every proxy ground-truth file was missed.
- Top ranked files: None

Future hypotheses:
- [VECTOR_BASELINE] A semantic retrieval baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.

## reqimpact-case-002-realworld-article-author-relation

- Outcome: PASS_PARTIAL
- Repo: `lujakob/nestjs-realworld-example-app`
- R@10: 0.3333
- P@10: 0.5000
- F1@10: 0.4000
- Hit files: src/article/article.entity.ts, src/article/article.service.ts
- Missed files: src/profile/profile.controller.ts, src/profile/profile.service.ts, src/user/user.entity.ts, src/user/user.service.ts
- Observed categories: SUPPORT_FILE_OVER_RETRIEVED, DATA_MODEL_MISSED, DOMAIN_ALIAS_MISSING, INDIRECT_DEPENDENCY_MISSED
- Explanation: Keyword overlap retrieved 2 ground-truth file(s). It still missed 4 ground-truth file(s). Top-10 also included 2 non-ground-truth file(s). Top ranked files were: src/article/article.controller.ts, src/article/article.entity.ts, src/article/article.service.ts.
- Top ranked files: src/article/article.controller.ts, src/article/article.entity.ts, src/article/article.service.ts, src/article/comment.entity.ts

Future hypotheses:
- [VECTOR_BASELINE] A semantic retrieval baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.
- [CURRENT_HYBRID] Hybrid retrieval may recover indirect dependency files if structural evidence links them to the retrieved direct hits.
- [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

## reqimpact-case-003-realworld-auth-middleware-user-object

- Outcome: PASS_FULL
- Repo: `lujakob/nestjs-realworld-example-app`
- R@10: 1.0000
- P@10: 0.5714
- F1@10: 0.7272
- Hit files: src/user/auth.middleware.ts, src/user/user.controller.ts, src/user/user.decorator.ts, src/user/user.service.ts
- Missed files: None
- Observed categories: None
- Explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- Top ranked files: src/user/auth.middleware.ts, src/user/dto/update-user.dto.ts, src/user/user.controller.ts, src/user/user.decorator.ts, src/user/user.entity.ts, src/user/user.module.ts, src/user/user.service.ts

Future hypotheses:
- [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

## reqimpact-case-004-nest-post-sse-empty-response

- Outcome: PASS_FULL
- Repo: `nestjs/nest`
- R@10: 1.0000
- P@10: 0.2500
- F1@10: 0.4000
- Hit files: integration/nest-application/sse/src/app.controller.ts, packages/core/router/router-response-controller.ts
- Missed files: None
- Observed categories: None
- Explanation: All proxy ground-truth files were retrieved within top-10 by exact file-path match.
- Top ranked files: packages/core/router/router-response-controller.ts, packages/core/router/sse-stream.ts, integration/nest-application/sse/src/app.controller.ts, integration/nest-application/sse/src/app.module.ts, packages/core/router/router-execution-context.ts, packages/core/router/router-explorer.ts, packages/core/router/router-proxy.ts, packages/core/router/routes-resolver.ts

Future hypotheses:
- [CURRENT_HYBRID] Precision and review burden should be compared against later baselines because lexical ranking can retrieve nearby support files even when recall is high.

## reqimpact-case-005-realworld-proper-error-object

- Outcome: FAIL_MISS
- Repo: `lujakob/nestjs-realworld-example-app`
- R@10: 0.0000
- P@10: 0.0000
- F1@10: 0.0000
- Hit files: None
- Missed files: src/shared/pipes/validation.pipe.ts, src/user/user.controller.ts, src/user/user.entity.ts
- Observed categories: LEXICAL_MISMATCH, DATA_MODEL_MISSED
- Explanation: No candidate artifact achieved keyword overlap with the requirement text, so every proxy ground-truth file was missed.
- Top ranked files: None

Future hypotheses:
- [VECTOR_BASELINE] A semantic retrieval baseline may recover files whose identifiers do not share strong lexical overlap with the requirement text.

## Implications for next phase

- Lexical miss cases support adding a vector-only baseline where requirement wording and artifact identifiers do not align directly.
- Over-retrieval cases justify tracking precision and review burden, not recall alone.
- If any ground-truth file is absent from candidateArtifacts, candidate completeness should be corrected before R1 comparisons.

## Warnings

- Changed files are proxy ground truth, not absolute impacted files.
- This failure analysis is based on keyword-baseline-v0 only.
- No vector, graph, DB, LLM, or R1 behavior is evaluated here.
