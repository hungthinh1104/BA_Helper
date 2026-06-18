# ReqImpact RAG Sample Export v0

- Run ID: rag-sample:case_only:reqimpact-case-006-squareboat-default-includes:2026-06-18T12-42-09-987Z
- Mode: CASE_ONLY
- Case ID: reqimpact-case-006-squareboat-default-includes
- Repo: squareboat/nestjs-boilerplate

## Requirement Text

fix: default includes in transformer class

## Ground Truth Note

Changed files are proxy ground truth. This smoke export is not a final benchmark result.

## Summary

- Top-K count: 10
- Ground-truth hits in top-K: 1
- Recall@10: 1
- Evidence coverage: 0
- Location-only evidence count: 0
- Code-like evidence count: 0
- Missed ground-truth files: none
- Unexpected top-K files: libs/boat/src/rest/explorer.ts, libs/boat/src/rest/explorer.ts, libs/boat/src/rest/guards.ts, libs/boat/src/rest/timeoutInterceptor.ts, libs/boat/src/validator/basevalidator.ts, libs/boat/src/validator/decorators/isValueFromConfig.ts, src/user/controllers/user.ts, src/user/services/user.ts, src/user/commands/greetUser.ts

## Top-K

| Rank | File | Type | Kind | Score | Final | Lexical | Vector | Graph | Kind Boost | Domain Boost | Signals | Evidence | Location-only | Code-like | Preview |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | libs/boat/src/transformers/transformer.ts | TRANSFORMER_FILE | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 2 | libs/boat/src/rest/explorer.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 3 | libs/boat/src/rest/explorer.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 4 | libs/boat/src/rest/guards.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 5 | libs/boat/src/rest/timeoutInterceptor.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 6 | libs/boat/src/validator/basevalidator.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 7 | libs/boat/src/validator/decorators/isValueFromConfig.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 8 | src/user/controllers/user.ts | API_ROUTE | API_ENDPOINT | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 9 | src/user/services/user.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 10 | src/user/commands/greetUser.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |

## Warnings

- CASE_ONLY mode does not execute retrieval. Candidate artifacts are exported in dataset order only.
- Changed files are proxy ground truth, not absolute truth.
