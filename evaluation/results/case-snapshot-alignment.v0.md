# Case Snapshot Alignment v0

Generated at: 2026-06-19T06:38:46.654Z

- Cases: 6
- ALIGNED_VECTOR_READY: 1
- ALIGNED_LEXICAL_ONLY: 1
- SNAPSHOT_MISSING: 4
- Clean retrieval eligible: 0
- Scanner coverage failures: 2

This registry does not run retrieval.
Only ALIGNED_VECTOR_READY cases are eligible for current-hybrid benchmark export.

## Status Meaning

- `ALIGNED_VECTOR_READY`: case baseSha matches a mapped snapshot commit, and the snapshot has usable non-fake vector state.
- `ALIGNED_LEXICAL_ONLY`: case baseSha matches a mapped snapshot commit, but usable vector state is not available.
- `SNAPSHOT_MISSING`: no local mapped snapshot exists yet for this case.
- `SNAPSHOT_COMMIT_MISMATCH`: do not run benchmark export; create/select a snapshot at the exact case baseSha.
- `REPO_MISMATCH`: do not run benchmark export until the mapping points at the correct repository.

## Cases

| Case | Repo | Base SHA | Status | Clean Retrieval | E2E | Scanner Coverage | Missing Indexed Ground Truth | Snapshot | Index Status | Chunks | Selected Profile | Profiles | Embeddings | Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| reqimpact-case-001-backend-reliability-semantics | hungthinh1104/BA_Helper | ba99ad7dc3cb9fc510fc4b821f35d2f0cc0aa80e | SNAPSHOT_MISSING | no | no | UNKNOWN | none | none | none | 0 | none | none | none | Create/index snapshot at case baseSha. |
| reqimpact-case-002-realworld-article-author-relation | lujakob/nestjs-realworld-example-app | 20b92a1017e31028aa0e00c894da70af813a86a1 | SNAPSHOT_MISSING | no | no | UNKNOWN | none | none | none | 0 | none | none | none | Create/index snapshot at case baseSha. |
| reqimpact-case-003-realworld-auth-middleware-user-object | lujakob/nestjs-realworld-example-app | a0edadd2812bea5f1ad00e4074ffb048d80df105 | SNAPSHOT_MISSING | no | no | UNKNOWN | none | none | none | 0 | none | none | none | Create/index snapshot at case baseSha. |
| reqimpact-case-004-nest-post-sse-empty-response | nestjs/nest | 02f804159841a2771755c382832a7938b904c420 | ALIGNED_LEXICAL_ONLY | no | yes | GROUND_TRUTH_NOT_INDEXED | packages/core/router/router-response-controller.ts | ef931de3-5b6e-4465-91c2-f7d6b46e6eed | VECTOR_FAILED | 0 | none | none | none | Selected embedding profile UNKNOWN is missing from snapshot chunks. |
| reqimpact-case-005-realworld-proper-error-object | lujakob/nestjs-realworld-example-app | 78e92f57b21038bbce0cde740dcbaeca68412c72 | SNAPSHOT_MISSING | no | no | UNKNOWN | none | none | none | 0 | none | none | none | Create/index snapshot at case baseSha. |
| reqimpact-case-006-squareboat-default-includes | squareboat/nestjs-boilerplate | 33ca78792610f1b0ece552767ef370bcb1978205 | ALIGNED_VECTOR_READY | no | yes | GROUND_TRUTH_NOT_INDEXED | libs/boat/src/transformers/transformer.ts | b8676c81-b19b-4c97-93a5-38125b9b525b | VECTOR_READY | 14 | google-gemini-001-1536 | google-gemini-001-1536 | gemini-embedding-001 | Vector-ready for E2E, but clean retrieval aggregate is blocked until ground-truth files are indexed as CodeArtifact rows. |

## Future CURRENT_HYBRID Command Template

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts \
  --caseId <aligned-case-id> \
  --projectId <project-id> \
  --repositoryId <repository-id> \
  --snapshotId <snapshot-id>
```

## Warnings

- This registry does not run retrieval.
- Only ALIGNED_VECTOR_READY cases are eligible for current-hybrid benchmark export.
