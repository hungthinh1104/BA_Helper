# ReqImpact RAG Sample Export v0

- Run ID: rag-sample:case_only:reqimpact-case-005-realworld-proper-error-object:2026-06-17T09-43-23-569Z
- Mode: CASE_ONLY
- Case ID: reqimpact-case-005-realworld-proper-error-object
- Repo: lujakob/nestjs-realworld-example-app

## Requirement Text

fix: Return proper error object

## Ground Truth Note

Changed files are proxy ground truth. This smoke export is not a final benchmark result.

## Summary

- Top-K count: 9
- Ground-truth hits in top-K: 3
- Recall@10: 1
- Evidence coverage: 0
- Location-only evidence count: 0
- Code-like evidence count: 0
- Missed ground-truth files: none
- Unexpected top-K files: src/shared/base.controller.ts, src/user/user.service.ts, src/user/auth.middleware.ts, src/user/user.decorator.ts, src/user/dto/create-user.dto.ts, src/user/dto/login-user.dto.ts

## Top-K

| Rank | File | Type | Kind | Score | Final | Lexical | Vector | Graph | Kind Boost | Domain Boost | Signals | Evidence | Location-only | Code-like | Preview |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | src/shared/pipes/validation.pipe.ts | PIPE_FILE |  | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 2 | src/user/user.controller.ts | CONTROLLER_FILE | API_ENDPOINT | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 3 | src/user/user.entity.ts | ENTITY_FILE | DATA_MODEL | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 4 | src/shared/base.controller.ts | CONTROLLER_FILE | API_ENDPOINT | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 5 | src/user/user.service.ts | SERVICE_FILE | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 6 | src/user/auth.middleware.ts | MIDDLEWARE_FILE | DOMAIN_SERVICE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 7 | src/user/user.decorator.ts | DECORATOR_FILE |  | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 8 | src/user/dto/create-user.dto.ts | DTO_FILE |  | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |
| 9 | src/user/dto/login-user.dto.ts | DTO_FILE |  | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |  | no | no | no |  |

## Warnings

- CASE_ONLY mode does not execute retrieval. Candidate artifacts are exported in dataset order only.
- Changed files are proxy ground truth, not absolute truth.
