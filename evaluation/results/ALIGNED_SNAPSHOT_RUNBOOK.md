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

## Phase 4E Candidate Discovery

- Goal: find one **new** public backend case that can become
  `ALIGNED_VECTOR_READY` before adding it to dataset v0.
- Result: **blocked on case quality, not on vector runtime**

### Candidate that reached real vector-ready state

- Repository: `https://github.com/Saluki/nestjs-template`
- Candidate PR: `https://github.com/Saluki/nestjs-template/pull/55`
- PR title: `Implemented Authentication`
- Public base ref used for scan: `master`
- Public base SHA resolved by scan:
  `d10b46097021e9d1fe8286995a0b685c8a444dfe`

### Local runtime IDs

- Project ID: `3744b50c-9cda-4c15-93df-0b4a9d21bff2`
- Repository ID: `643d9d25-ae49-4c2e-835c-22e5e9458ec4`
- Scan Job ID: `17b97eec-dc13-4104-a522-e10edbcee535`
- Snapshot ID: `ba8d4eb8-e713-4bcf-ae31-12af1690b614`
- Snapshot commit SHA: `d10b46097021e9d1fe8286995a0b685c8a444dfe`
- Index status: `VECTOR_READY`
- Coverage status: `READY`
- Chunker version: `artifact-chunker@0.1.0`

### Why this candidate was not added as Case 006

The infrastructure gate passed:

- the repo is public
- the base ref is public and resolvable through the product scan workflow
- the local snapshot reached `VECTOR_READY`
- the embedding path used the real provider, not `fake-embedding`

But the evaluation-case gate failed:

- PR `#55` is primarily an **auth module introduction** on top of a base tree
  that does not yet contain those auth implementation files
- most meaningful backend files in the PR are **newly introduced files**, not
  existing artifacts in the base snapshot candidate universe
- that makes it a weak fit for ReqImpact v0, which is intended to evaluate
  requirement-to-**existing-code** impact retrieval rather than greenfield file
  creation

### Practical consequence

- This candidate proves the smaller real-provider path can reach
  `VECTOR_READY` without the Google quota failure seen on `nestjs/nest`.
- It does **not** justify adding a dataset case, because doing so would blur
  the file-level retrieval target with new-file implementation work.
- Therefore:
  - `evaluation/datasets/cases.v0.json` remains unchanged
  - `evaluation/datasets/case-snapshot-overrides.v0.json` remains unchanged
  - no current-hybrid benchmark export was run
  - no `vector-baseline.v0.json` was created

## Phase 4G Squareboat Verification

- Goal: verify whether the recommended discovery candidate can be materialized
  at the exact dataset base SHA and then indexed to `VECTOR_READY`.
- Candidate:
  - repo: `https://github.com/squareboat/nestjs-boilerplate`
  - PR: `https://github.com/squareboat/nestjs-boilerplate/pull/37`
  - title: `FIX: default includes`
  - required changed backend file:
    `libs/boat/src/transformers/transformer.ts`
- Result: **blocked before snapshot publication**

### Public metadata verified

- PR base SHA: `33ca78792610f1b0ece552767ef370bcb1978205`
- PR head SHA: `355af958495378cb6d24e75316d1a41128699653`
- Changed files:
  - `libs/boat/src/transformers/transformer.ts`
  - `package.json`
- Requirement text derivable from public evidence:
  - the pull request fixes the issue with default includes in the Transformer
    class

### Local runtime attempt

- Project ID: `a89660ef-6a15-4f65-a53d-2dbb1218a2ea`
- Repository ID: `b8687312-ed36-4bca-b519-32b6e49b31f4`
- Scan Job ID: `a61d1898-31c2-4565-81c1-4d3d36fe5a89`
- Requested ref: `33ca78792610f1b0ece552767ef370bcb1978205`

### Exact blocker

The existing product scan workflow still clones with:

- `git clone --depth 1 --branch <ref> --single-branch`

When the exact PR base SHA was submitted as `ref`, the job failed at
`CLONING_REPO` with:

```text
CLONE_FAILED
fatal: Remote branch 33ca78792610f1b0ece552767ef370bcb1978205 not found in upstream origin
```

The runtime API result was:

- `status = FAILED`
- `stage = DONE`
- `snapshotId = null`
- `sourceTargetId = null`

### Why this blocks Case 006

- The candidate still passes the **case quality gate** from Phase 4F.
- It fails the **snapshot materialization gate** required by Phase 4G.
- No exact base snapshot means:
  - no aligned `snapshot.commitSha`
  - no vector indexing attempt against the required commit
  - no legal basis to add `reqimpact-case-006-squareboat-default-includes`

### Practical consequence

- `cases.v0.json` remains unchanged at 5 cases.
- `case-snapshot-overrides.v0.json` remains unchanged.
- `db-snapshot-readiness.v0.*` remains unchanged because no new snapshot was
  published.
- `case-snapshot-alignment.v0.*` remains unchanged because no new mapping or
  aligned snapshot exists.
- no current-hybrid benchmark export was run.
- no `vector-baseline.v0.json` was created.
