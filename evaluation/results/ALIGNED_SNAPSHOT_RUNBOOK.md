# Aligned Snapshot Runbook

## Selected Case

- Case ID: `reqimpact-case-004-nest-post-sse-empty-response`
- Repo URL: `https://github.com/nestjs/nest`
- Base SHA: `02f804159841a2771755c382832a7938b904c420`
- Public tag used for scan: `v11.1.25`

## Local Runtime IDs

- Project ID: `84bdbbc6-d70c-4f1f-b17c-a379a3682952`
- Repository ID: `6e99eeb1-02b2-422b-939d-d9d5174ac77a`
- Scan Job ID: `6b450c75-42ec-438f-aace-b53aae3cdbf6`
- Snapshot ID: `ef931de3-5b6e-4465-91c2-f7d6b46e6eed`

## Commands / API Steps Used

1. Bootstrap admin token:

```bash
curl -X POST http://localhost:3001/api/v1/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"research-admin@example.com","role":"ADMIN"}'
```

2. Create or reuse project:

```bash
POST /api/v1/projects
{"name":"Research Eval Nest"}
```

3. Create or reuse repository:

```bash
POST /api/v1/projects/:projectId/repositories
{"url":"https://github.com/nestjs/nest"}
```

4. Queue scan at the public tag that peels to the dataset base SHA:

```bash
POST /api/v1/repositories/:repositoryId/scan-jobs
{"ref":"v11.1.25","requestKey":"a7f4eb63-afc7-4b98-8a2f-f3502ddd76b7"}
```

## Verification

- Repository detail showed:
  - `latestSnapshot.id = ef931de3-5b6e-4465-91c2-f7d6b46e6eed`
  - `latestSnapshot.commitSha = 02f804159841a2771755c382832a7938b904c420`
  - `latestSnapshot.coverageStatus = READY`
- Worker log showed:
  - scan completed successfully for `requestedRef = v11.1.25`
  - published snapshot commit exactly matched the dataset `baseSha`

## Embedding Provider / Chunker

- Embedding provider configured: `google`
- Embedding model requested by runtime: `gemini-embedding-001`
- Chunker version path: `artifact-chunker@0.1.0`

## Why Fake Snapshot Is Excluded

- Existing fake snapshot rows under other repositories are not evaluation-valid.
- A fake-embedding snapshot must not be treated as `ALIGNED_VECTOR_READY`.
- This phase required a real scan/index attempt against an existing dataset case.

## Current Blocker

- This snapshot is aligned by repo and commit, but it is **not** vector-ready yet.
- Worker logs show Google embedding failed with:
  - `429 Too Many Requests`
  - quota metric: `generativelanguage.googleapis.com/embed_content_free_tier_requests`
- The runtime attempted embeddings for `807` texts and the snapshot ended at:
  - `indexStatus = VECTOR_FAILED`

## Important Boundary

- No current-hybrid benchmark export was run in this phase.
- No `vector-baseline.v0.json` was created in this phase.
