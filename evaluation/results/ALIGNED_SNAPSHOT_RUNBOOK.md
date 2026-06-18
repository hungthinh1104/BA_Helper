# Aligned Snapshot Runbook

## Phase 4D Outcome

- Goal: find a smaller existing dataset case that can become `ALIGNED_VECTOR_READY`
  under the current product scan workflow.
- Result: **blocked**
- Reason:
  - the preferred smaller cases from `lujakob/nestjs-realworld-example-app`
    (`reqimpact-case-002`, `reqimpact-case-003`, `reqimpact-case-005`) do not
    have any currently public branch/tag ref that resolves exactly to their
    dataset `baseSha`
  - the current scan workflow accepts a repository URL plus a `ref`, and the
    runtime clone path currently works with public branch/tag refs, not an
    arbitrary detached commit SHA
- Practical consequence:
  - the only existing dataset case currently proven scan-alignable through the
    public product workflow is still
    `reqimpact-case-004-nest-post-sse-empty-response`
  - that case aligns by commit, but remains `ALIGNED_LEXICAL_ONLY` because real
    Google embedding hit quota and the snapshot ended `VECTOR_FAILED`

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
- Snapshot commit SHA: `02f804159841a2771755c382832a7938b904c420`
- Index status: `VECTOR_FAILED`
- Chunk count: `0`
- Embedding model: `none persisted`
- Chunker version: `none persisted`
- Alignment state: `ALIGNED_LEXICAL_ONLY`

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

## Smaller Case Screening

The following existing dataset cases were checked first because they are
expected to be smaller than the Nest framework repository case:

- `reqimpact-case-003-realworld-auth-middleware-user-object`
  - repo: `https://github.com/lujakob/nestjs-realworld-example-app`
  - base SHA: `a0edadd2812bea5f1ad00e4074ffb048d80df105`
  - refs checked: `HEAD`, `refs/heads/*`, `refs/tags/*`, `refs/pull/*`
  - result: no public remote ref currently resolves to this SHA
- `reqimpact-case-002-realworld-article-author-relation`
  - base SHA: `20b92a1017e31028aa0e00c894da70af813a86a1`
  - refs checked: `HEAD`, `refs/heads/*`, `refs/tags/*`, `refs/pull/*`
  - result: no public remote ref currently resolves to this SHA
- `reqimpact-case-005-realworld-proper-error-object`
  - base SHA: `78e92f57b21038bbce0cde740dcbaeca68412c72`
  - refs checked: `HEAD`, `refs/heads/*`, `refs/tags/*`, `refs/pull/*`
  - result: no public remote ref currently resolves to this SHA

For completeness, the other existing dataset repos were also checked:

- `hungthinh1104/BA_Helper`
  - case: `reqimpact-case-001-backend-reliability-semantics`
  - base SHA: `ba99ad7dc3cb9fc510fc4b821f35d2f0cc0aa80e`
  - refs checked: `HEAD`, `refs/heads/*`, `refs/tags/*`, `refs/pull/*`
  - result: no public remote ref currently resolves to this SHA
- `nestjs/nest`
  - case: `reqimpact-case-004-nest-post-sse-empty-response`
  - base SHA: `02f804159841a2771755c382832a7938b904c420`
  - refs checked: `HEAD`, `refs/heads/*`, `refs/tags/*`, `refs/pull/*`
  - result: public tag `v11.1.25^{}` resolves to this SHA, so this is the only
    currently product-scan-alignable dataset case

So Phase 4D could not legally switch to a smaller aligned case without either:

- changing product clone behavior to support detached commit fetches, or
- changing the dataset to a case whose `baseSha` is reachable through a public
  branch/tag ref

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
