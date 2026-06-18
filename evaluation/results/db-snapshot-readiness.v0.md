# DB Snapshot Readiness v0

Generated at: 2026-06-18T14:45:05.438Z

Status: READY_CANDIDATES_FOUND

DATABASE_URL present: yes
DB inspected read-only: yes

This is not a benchmark result.
No retrieval was executed.
No vector-baseline.v0.json was created.

## Summary

- Projects: 8
- Repositories: 7
- Snapshots: 7
- Vector-ready candidates: 1
- Lexical-only candidates: 3

## Candidates

| Project | Repository | Snapshot | Commit | Index Status | Chunks | Profiles | Providers | Models | Dims | Chunkers | Classification | Usable For | Warnings |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| a89660ef-6a15-4f65-a53d-2dbb1218a2ea | b8687312-ed36-4bca-b519-32b6e49b31f4 | b8676c81-b19b-4c97-93a5-38125b9b525b | 33ca78792610f1b0ece552767ef370bcb1978205 | VECTOR_READY | 14 | google-gemini-001-1536 | google | gemini-embedding-001 | 1536 | artifact-chunker@0.1.0 | VECTOR_READY_CANDIDATE | VECTOR_BASELINE, CURRENT_HYBRID_EXPORT | none |
| 3744b50c-9cda-4c15-93df-0b4a9d21bff2 | 643d9d25-ae49-4c2e-835c-22e5e9458ec4 | ba8d4eb8-e713-4bcf-ae31-12af1690b614 | d10b46097021e9d1fe8286995a0b685c8a444dfe | VECTOR_READY | 14 | none | none | gemini-embedding-001 | none | artifact-chunker@0.1.0 | LEGACY_PROFILE_MISSING | none | EmbeddingChunk rows exist but embeddingProfileId metadata is missing; treat these rows as legacy and not benchmark-ready. |
| 84bdbbc6-d70c-4f1f-b17c-a379a3682952 | 6e99eeb1-02b2-422b-939d-d9d5174ac77a | ef931de3-5b6e-4465-91c2-f7d6b46e6eed | 02f804159841a2771755c382832a7938b904c420 | VECTOR_FAILED | 0 | none | none | none | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is VECTOR_FAILED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| ff6fd8e0-8ded-46bf-adfe-0e02b586977f | 40772cf0-8f58-49c4-8a97-df2c6730a759 | 5d7d7147-5410-4ea0-993c-a16e3732c175 | mock-commit-sha | NOT_INDEXED | 0 | none | none | none | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is NOT_INDEXED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| 1f19825e-6ed9-48d0-a226-ce2bcdb4cac8 | 7e6fb612-55d2-4849-8226-48b89837235c | b2196b22-2a89-472a-942a-cc606e5cf0f4 | mock-commit-sha | NOT_INDEXED | 0 | none | none | none | none | none | LEXICAL_ONLY_CANDIDATE | CURRENT_HYBRID_EXPORT | Snapshot indexStatus is NOT_INDEXED; vector retrieval may be absent or incomplete. ; No EmbeddingChunk rows exist for this snapshot. |
| ab9bd99d-2b54-44ac-bd20-3f017a84cdff | d7b8030c-a4fb-4b24-b27d-0375c06ccd0d | 444246fb-2942-4668-be16-85bcf3164fe0 | f26cd56837cd10a1c00bb89d74d97519abc6f732 | VECTOR_READY | 31 | none | none | gemini-embedding-001 | none | artifact-chunker@0.1.0 | LEGACY_PROFILE_MISSING | none | EmbeddingChunk rows exist but embeddingProfileId metadata is missing; treat these rows as legacy and not benchmark-ready. |
| ab9bd99d-2b54-44ac-bd20-3f017a84cdff | d7b8030c-a4fb-4b24-b27d-0375c06ccd0d | 01eab892-56ed-45cc-844d-c6b9a66d80c9 | f26cd56837cd10a1c00bb89d74d97519abc6f732 | VECTOR_READY | 31 | none | none | fake-embedding | none | artifact-chunker@0.1.0 | LEGACY_PROFILE_MISSING | none | EmbeddingChunk rows exist but embeddingProfileId metadata is missing; treat these rows as legacy and not benchmark-ready. |

## Next Inputs Needed

- --projectId a89660ef-6a15-4f65-a53d-2dbb1218a2ea
- --repositoryId b8687312-ed36-4bca-b519-32b6e49b31f4
- --snapshotId b8676c81-b19b-4c97-93a5-38125b9b525b

## Next Commands

Only use a caseId that is explicitly aligned in evaluation/results/case-snapshot-alignment.v0.json.

### CURRENT_HYBRID export

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts --caseId <aligned-case-id> --projectId a89660ef-6a15-4f65-a53d-2dbb1218a2ea --repositoryId b8687312-ed36-4bca-b519-32b6e49b31f4 --snapshotId b8676c81-b19b-4c97-93a5-38125b9b525b
```

### Future persisted-vector baseline inputs

```bash
pnpm exec ts-node --project tsconfig.json evaluation/scripts/run-vector-baseline.ts --projectId a89660ef-6a15-4f65-a53d-2dbb1218a2ea --repositoryId b8687312-ed36-4bca-b519-32b6e49b31f4 --snapshotId b8676c81-b19b-4c97-93a5-38125b9b525b
```

## Warnings

- This probe does not run retrieval.
- This probe does not create vector-baseline.v0.json.
