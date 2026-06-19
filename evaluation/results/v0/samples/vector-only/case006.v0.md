# Vector-Only Case006 Probe

Mode: VECTOR_ONLY_CASE_PROBE
Scope: Single-case only, not aggregate benchmark
Case: reqimpact-case-006-squareboat-default-includes
Repo: squareboat/nestjs-boilerplate
Ground truth: libs/boat/src/transformers/transformer.ts

## Embedding Provenance
Provider: google
Model: gemini-embedding-001
Query dimensions: 1536
Document dimensions: 1536
Query task type: RETRIEVAL_QUERY
Document task type: RETRIEVAL_DOCUMENT
Profile compatible: true

## Retrieval Result
| Rank | FilePath | Final Score | Vector Score | Lexical | Graph | Evidence | Signals |
| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| 1 | libs/boat/src/transformers/transformer.ts | 0.7904 | 0.7904 | 0 | 0 | EVIDENCED | VECTOR |
| 2 | libs/boat/src/interfaces/transformer.ts | 0.7722 | 0.7722 | 0 | 0 | EVIDENCED | VECTOR |
| 3 | src/transformer/user/detail.ts | 0.7460 | 0.7460 | 0 | 0 | EVIDENCED | VECTOR |
| 4 | libs/boat/src/rest/restController.ts | 0.7207 | 0.7207 | 0 | 0 | EVIDENCED | VECTOR |
| 5 | src/transformer/index.ts | 0.7141 | 0.7141 | 0 | 0 | EVIDENCED | VECTOR |
| 6 | src/transformer/user/index.ts | 0.6968 | 0.6968 | 0 | 0 | EVIDENCED | VECTOR |
| 7 | libs/boat/src/rest/guards.ts | 0.6875 | 0.6875 | 0 | 0 | EVIDENCED | VECTOR |
| 8 | libs/boat/src/interfaces/index.ts | 0.6692 | 0.6692 | 0 | 0 | EVIDENCED | VECTOR |
| 9 | libs/boat/src/index.ts | 0.6678 | 0.6678 | 0 | 0 | EVIDENCED | VECTOR |
| 10 | libs/boat/src/validator/index.ts | 0.6674 | 0.6674 | 0 | 0 | EVIDENCED | VECTOR |
| 11 | libs/boat/src/utils/context.ts | 0.6624 | 0.6624 | 0 | 0 | EVIDENCED | VECTOR |
| 12 | src/user/models/user.ts | 0.6619 | 0.6619 | 0 | 0 | EVIDENCED | VECTOR |
| 13 | libs/boat/src/rest/interfaces.ts | 0.6607 | 0.6607 | 0 | 0 | EVIDENCED | VECTOR |
| 14 | libs/boat/src/rest/metadata.ts | 0.6588 | 0.6588 | 0 | 0 | EVIDENCED | VECTOR |
| 15 | libs/boat/src/service.ts | 0.6581 | 0.6581 | 0 | 0 | EVIDENCED | VECTOR |
| 16 | libs/boat/src/utils/collection.ts | 0.6573 | 0.6573 | 0 | 0 | EVIDENCED | VECTOR |
| 17 | src/user/repositories/user/contract.ts | 0.6567 | 0.6567 | 0 | 0 | EVIDENCED | VECTOR |
| 18 | config/services.ts | 0.6565 | 0.6565 | 0 | 0 | EVIDENCED | VECTOR |
| 19 | src/user/repositories/user/database.ts | 0.6544 | 0.6544 | 0 | 0 | EVIDENCED | VECTOR |
| 20 | libs/boat/src/rest/decorators.ts | 0.6531 | 0.6531 | 0 | 0 | EVIDENCED | VECTOR |

## Ground Truth Hit
groundTruthHitAtK: true

## Oracle Check
status: NOT_AVAILABLE
reason: Exact flat vector oracle is not implemented yet

## Known Limits
- Single-case probe only, not an aggregate benchmark
- Changed files are proxy ground truth
- Vector-only result is path validation, not product ranking approval
