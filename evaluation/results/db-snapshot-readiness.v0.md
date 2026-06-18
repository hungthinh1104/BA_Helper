# DB Snapshot Readiness v0

Generated at: 2026-06-18T03:53:20.474Z

Status: READY_CANDIDATES_FOUND

DATABASE_URL present: yes
DB inspected read-only: yes

This is not a benchmark result.
No retrieval was executed.
No vector-baseline.v0.json was created.

## Summary

- Projects: 5
- Repositories: 5
- Snapshots: 5
- Vector-ready candidates: 2
- Lexical-only candidates: 3

## Candidates

| Project | Repository | Snapshot | Commit | Index Status | Chunks | Models | Chunkers | Classification | Usable For | Warnings |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| 84bdbbc6-d70c-4f1f-b17c-a379a3682952 | 6e99eeb1-02b2-422b-939d-d9d5174ac77a | ef931de3-5b6e-4465-91c2-f7d6b46e6eed | 02f804159841a2771755c382832a7938b904c420 | VECTOR_FAILED | 0 | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is VECTOR_FAILED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| ff6fd8e0-8ded-46bf-adfe-0e02b586977f | 40772cf0-8f58-49c4-8a97-df2c6730a759 | 5d7d7147-5410-4ea0-993c-a16e3732c175 | mock-commit-sha | NOT_INDEXED | 0 | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is NOT_INDEXED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| 1f19825e-6ed9-48d0-a226-ce2bcdb4cac8 | 7e6fb612-55d2-4849-8226-48b89837235c | b2196b22-2a89-472a-942a-cc606e5cf0f4 | mock-commit-sha | NOT_INDEXED | 0 | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is NOT_INDEXED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| ab9bd99d-2b54-44ac-bd20-3f017a84cdff | d7b8030c-a4fb-4b24-b27d-0375c06ccd0d | 444246fb-2942-4668-be16-85bcf3164fe0 | f26cd56837cd10a1c00bb89d74d97519abc6f732 | VECTOR_READY | 31 | gemini-embedding-001 | artifact-chunker@0.1.0 | VECTOR_READY_CANDIDATE | VECTOR_BASELINE, CURRENT_HYBRID_EXPORT | none |
| ab9bd99d-2b54-44ac-bd20-3f017a84cdff | d7b8030c-a4fb-4b24-b27d-0375c06ccd0d | 01eab892-56ed-45cc-844d-c6b9a66d80c9 | f26cd56837cd10a1c00bb89d74d97519abc6f732 | VECTOR_READY | 31 | fake-embedding | artifact-chunker@0.1.0 | VECTOR_READY_CANDIDATE | VECTOR_BASELINE, CURRENT_HYBRID_EXPORT | none |

## Next Inputs Needed

- --projectId ab9bd99d-2b54-44ac-bd20-3f017a84cdff
- --repositoryId d7b8030c-a4fb-4b24-b27d-0375c06ccd0d
- --snapshotId 444246fb-2942-4668-be16-85bcf3164fe0

## Next Commands

### CURRENT_HYBRID export

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts --caseId reqimpact-case-001-backend-reliability-semantics --projectId ab9bd99d-2b54-44ac-bd20-3f017a84cdff --repositoryId d7b8030c-a4fb-4b24-b27d-0375c06ccd0d --snapshotId 444246fb-2942-4668-be16-85bcf3164fe0
```

### Future persisted-vector baseline inputs

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/run-vector-baseline.ts --projectId ab9bd99d-2b54-44ac-bd20-3f017a84cdff --repositoryId d7b8030c-a4fb-4b24-b27d-0375c06ccd0d --snapshotId 444246fb-2942-4668-be16-85bcf3164fe0
```

## Warnings

- This probe does not run retrieval.
- This probe does not create vector-baseline.v0.json.
