# Case Selection Notes v0

## Case 006

### Source repository

- Repository: `squareboat/nestjs-boilerplate`
- PR link:
  `https://github.com/squareboat/nestjs-boilerplate/pull/37`
- Issue link:
  `https://github.com/squareboat/nestjs-boilerplate/issues/36`
- Base commit:
  `33ca78792610f1b0ece552767ef370bcb1978205`
- Head / commit SHA:
  `355af958495378cb6d24e75316d1a41128699653`

### Public evidence used to infer requirementText

- PR title:
  `FIX: default includes`
- PR description/comment:
  the pull request fixes the issue with default includes in the Transformer
  class

### Changed backend files used as proxy ground truth

- `libs/boat/src/transformers/transformer.ts`

### Excluded files and why

- `package-lock.json` was excluded from `groundTruth.files` because it is
  dependency-lock noise, not the backend requirement target.
- No frontend-only or docs-only files were part of this PR.
- Neighbor files under `libs/boat/src/rest` and `libs/boat/src/validator` were
  kept as candidates rather than ground truth because they are plausible
  implementation distractors around request transformation and validation.

### Candidate artifact construction method

- Candidate artifacts were built from the pre-change snapshot aligned to
  `baseSha = 33ca78792610f1b0ece552767ef370bcb1978205`.
- The pool combines:
  - persisted scanner artifacts already extracted from that snapshot
  - the changed `transformer.ts` file itself as a manual file-level candidate
  - nearby rest/validator/user-layer neighbors that are plausible retrieval
    distractors
- The candidate file set is broader than the proxy ground truth and includes
  multiple non-ground-truth neighbors.

### Ground truth limitation statement

`groundTruth.files` in v0 is a practical proxy derived from the public PR’s
changed backend implementation file. It is not absolute truth. Some nearby
files may still be relevant implementation context, and the selected file set
does not claim method-level necessity.

### Known threats to validity

- The scanner-aligned base snapshot did **not** persist
  `libs/boat/src/transformers/transformer.ts` as a `CodeArtifact`, so the case
  currently mixes real extracted artifacts with one manual file-level candidate.
- That means the case is valid for dataset/file-level evaluation, but it also
  captures a scanner-coverage gap that may block later persisted-hybrid
  retrieval from surfacing the ground-truth file directly.
- This remains a file-level-only case. No method-level accuracy claim is made.

### Suitability

This case is suitable for file-level evaluation only in v0.

## Phase 4E Screening Note

### Candidate screened but rejected for dataset addition

- Repository: `Saluki/nestjs-template`
- PR:
  `https://github.com/Saluki/nestjs-template/pull/55`
- PR title:
  `Implemented Authentication`
- Public base ref used for local scan:
  `master`
- Local aligned snapshot reached real `VECTOR_READY` at:
  `d10b46097021e9d1fe8286995a0b685c8a444dfe`

### Why it was rejected as Case 006

- The case is public and runtime-viable, but it is not a strong ReqImpact v0
  evaluation case.
- The PR mainly introduces new authentication files and related module
  scaffolding rather than modifying a stable existing backend slice already
  present in the base snapshot.
- That means the changed-file proxy would over-represent **new file creation**
  instead of requirement-to-existing-code impact retrieval.

### Decision

- Do not add this candidate to `cases.v0.json`.
- Keep dataset v0 focused on file-level impact over code that already exists in
  the selected base snapshot.
- Treat this candidate as proof that a smaller repo can reach real
  `VECTOR_READY`, not as proof that it is a valid evaluation case.

## Case 006 Blocker

### Target snapshot alignment requirement

- Target repository: `ndmen/booking`
- Snapshot ID:
  `444246fb-2942-4668-be16-85bcf3164fe0`
- Snapshot commit SHA:
  `f26cd56837cd10a1c00bb89d74d97519abc6f732`
- Project ID:
  `ab9bd99d-2b54-44ac-bd20-3f017a84cdff`
- Repository ID:
  `d7b8030c-a4fb-4b24-b27d-0375c06ccd0d`

### Public evidence inspected

- Snapshot commit:
  `https://github.com/ndmen/booking/commit/f26cd56837cd10a1c00bb89d74d97519abc6f732`
- Public commit history:
  `https://github.com/ndmen/booking/commits/main/`

### Why no case was added yet

The alignment rule for this phase requires an evaluation case whose
`baseSha` is exactly:

`f26cd56837cd10a1c00bb89d74d97519abc6f732`

That snapshot commit is currently the public tip commit on `main`, and the
public repo shows:

- latest visible commit: `f26cd56` with message `Update README.md`
- public pull requests: `0`

So there is no confidently verifiable public descendant backend change whose
base is `f26cd56837cd10a1c00bb89d74d97519abc6f732`.

### Why this blocks an evaluation-valid case

- Using `f26cd56` itself would fail the phase rule because the aligned change
  is README-only, not a backend requirement/behavior/workflow/validation/domain
  logic change.
- Using an older backend commit such as `2adedd4` would break the required
  `baseSha == snapshot.commitSha` invariant.
- No public PR branch was available to prove a later backend change based on
  `f26cd56`.

### Candidate artifact construction status

No candidate artifact set was added for Case 006 because doing so without a
valid aligned public change would fabricate the evaluation case boundary.

### Threats to validity / operational note

- The DB snapshot is real and vector-ready, but dataset alignment still depends
  on a public repo history point that can be paired with the snapshot commit as
  `baseSha`.
- Until such a public aligned change exists, current-hybrid export for
  `ndmen/booking` would be DB-valid but not evaluation-valid for dataset v0.
- This remains a file-level evaluation workflow only; no method-level claim is
  implied.

## Case 001

### Source repo

- Repository: `hungthinh1104/BA_Helper`
- Commit URL:
  `https://github.com/hungthinh1104/BA_Helper/commit/b92c98debd563143862f4a4b21216836e1adf1d0`
- Base commit:
  `https://github.com/hungthinh1104/BA_Helper/commit/ba99ad7dc3cb9fc510fc4b821f35d2f0cc0aa80e`

### PR / issue / commit links

- Public commit:
  `https://github.com/hungthinh1104/BA_Helper/commit/b92c98debd563143862f4a4b21216836e1adf1d0`
- No public issue or pull request discussion was available for this first seed
  case, so the commit title is used as the requirement-text proxy:
  `fix: harden backend reliability semantics`

### Why this case qualifies

- It is a real public backend-oriented code change in the public BA_Helper /
  ReqImpact repository.
- The change is not frontend-only, dependency-only, formatting-only, CI-only,
  or docs-only.
- The commit touches backend lifecycle correctness around analysis creation,
  finalization, evidence/report semantics, queue behavior, and review queue
  summaries.
- It is small enough to inspect manually and explicit enough to seed the first
  file-level evaluation case.

### Why excluded files are excluded

Excluded from `groundTruth.files`:

- New files created by the commit, such as the migration SQL file and
  `analyzer-version.ts`, because v0 candidate artifacts are intended to model a
  pre-change repository candidate universe. Newly created files are not
  retrievable from the pre-change tree.
- Test files, because Phase 1B is seeding a file-level backend implementation
  case, not a test-maintenance evaluation case.
- Web UI files, because the research scope here is requirement-to-backend-code
  impact analysis.
- Smoke/demo helper changes that are supportive but not central to the backend
  reliability requirement target.

### Ground truth limitation statement

`groundTruth.files` in v0 is a practical proxy derived from changed backend and
shared-contract files in the public commit. It is not absolute truth. Some
files excluded from the list may still be legitimately relevant in a broader
maintenance sense, while some included files may reflect implementation choices
rather than minimal necessity.

### Candidate artifact construction method

- Candidate artifacts were constructed manually from the pre-change repository
  structure at base commit `ba99ad7`.
- The set intentionally includes:
  - expected impacted backend lifecycle files
  - related contract/schema files
  - plausible non-impacted neighboring files such as repository and read-model
    helpers
- The candidate artifact file set is broader than the selected ground-truth
  file set and includes at least two non-ground-truth files.

### Known threats to validity

- Requirement text is proxied from the commit title because no public issue/PR
  discussion was available.
- This is the project’s own public repository, so the case is realistic but not
  independent of the system under study.
- The candidate universe is manually assembled rather than exported directly
  from scanner output in this phase.
- Ground truth is file-level only and does not capture method-level necessity
  or ordering dependencies.
- Excluding newly created files makes the case more faithful to pre-change
  retrieval, but also means the file-level proxy under-represents implementation
  additions.

### Suitability

This case is suitable for file-level evaluation only in v0.

## Case 004

### Source repository

- Repository: `nestjs/nest`
- Issue link:
  `https://github.com/nestjs/nest/issues/17098`
- Commit link:
  `https://github.com/nestjs/nest/commit/d152eec8ebba6a38eb448021a83018b43372192e`
- Base commit:
  `02f804159841a2771755c382832a7938b904c420`
- Head/commit SHA:
  `d152eec8ebba6a38eb448021a83018b43372192e`

### Public evidence used to infer requirementText

- Commit title:
  `fix(core): post sse endpoint empty response`
- Public issue number in commit message:
  `#17098`

### Changed backend files used as proxy ground truth

- `integration/nest-application/sse/src/app.controller.ts`
- `packages/core/router/router-response-controller.ts`

### Excluded files and why

- Integration spec files were excluded from `groundTruth.files` because v0 is
  focused on backend implementation impact, not test-maintenance impact.
- `package.json` was not involved in this commit, so no config/dependency noise
  had to be handled.
- Neighbor router files were kept as candidates, not ground truth, because they
  are plausible retrieval distractors around SSE behavior.

### Candidate artifact construction method

- Candidate artifacts were assembled manually from the pre-change
  `packages/core/router` subtree plus the SSE sample app module/controller.
- The candidate set intentionally includes changed implementation files and
  nearby non-changed router components.

### Ground truth limitation statement

The selected `groundTruth.files` are a practical file-level proxy derived from
public changed backend implementation files. They do not claim to capture every
file that might be semantically related to SSE response behavior.

### Threats to validity

- This is a framework repository, not an application repository.
- Requirement text is inferred from public issue/commit title rather than a BA
  requirement document.
- Excluding changed test files narrows evaluation to implementation impact only.

### Suitability

This case is suitable for file-level evaluation only in v0, not method-level.

## Case 005

### Source repository

- Repository: `lujakob/nestjs-realworld-example-app`
- Commit link:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/cbb92cf40d47da79812833ef0e75618df95113d1`
- Base commit:
  `78e92f57b21038bbce0cde740dcbaeca68412c72`
- Head/commit SHA:
  `cbb92cf40d47da79812833ef0e75618df95113d1`

### Public evidence used to infer requirementText

- Commit title:
  `fix: Return proper error object`

### Changed backend files used as proxy ground truth

- `src/shared/pipes/validation.pipe.ts`
- `src/user/user.controller.ts`
- `src/user/user.entity.ts`

### Excluded files and why

- DTO, middleware, decorator, and service files were not placed in ground truth
  because they were unchanged in the commit, but they remain plausible
  candidates around the validation/user flow.
- No frontend or docs files were involved.

### Candidate artifact construction method

- Candidate artifacts were assembled manually from the pre-change `src/shared`
  and `src/user` tree.
- The set includes changed files plus plausible neighbors like DTOs,
  middleware, decorator, and service files.

### Ground truth limitation statement

The selected changed backend files are used only as a practical file-level
proxy. They do not claim full semantic completeness for validation/user error
handling logic.

### Threats to validity

- Requirement text is commit-title-derived.
- Candidate artifacts are manually assembled rather than scanner-exported.
- The commit is relatively small, so retrieval difficulty is moderate rather
  than broad.

### Suitability

This case is suitable for file-level evaluation only in v0, not method-level.
It is not suitable for method-level accuracy claims yet.

## Case 002

### Source repo

- Repository: `lujakob/nestjs-realworld-example-app`
- Commit URL:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/2b56fb43bb99ad18cef26dcd70882b4e7c83d96d`
- Base commit:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/20b92a1017e31028aa0e00c894da70af813a86a1`

### PR / issue / commit links

- Public commit:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/2b56fb43bb99ad18cef26dcd70882b4e7c83d96d`
- No issue or pull request URL was recovered confidently from local git history,
  so the commit title is used as the requirement-text proxy:
  `fix: article author relation`

### Why this case qualifies

- External public repository, not BA_Helper.
- NestJS backend application.
- The change affects backend relationship and profile/article behavior, not docs,
  frontend, dependency bumps, or CI.
- The changed files cluster cleanly in article/profile/user modules.

### Why excluded files are excluded

- DTO index files, module files, and unchanged neighbors are kept as candidate
  artifacts only where they are plausible retrieval distractors.
- Files outside article/profile/user scope were excluded because they are weakly
  connected to the observed behavior change.

### Ground truth limitation statement

`groundTruth.files` is derived from backend files changed in the public commit.
It is a practical file-level proxy, not absolute truth about all semantically
relevant code.

### Candidate artifact construction method

- Candidate artifacts were assembled manually from the pre-change
  `src/article`, `src/profile`, and `src/user` structure.
- The set includes both changed files and plausible non-changed neighbors such
  as controller/entity/module-adjacent files.

### Known threats to validity

- Requirement text is proxied from the commit title.
- Candidate artifacts are manually assembled rather than scanner-exported.
- This case measures file-level retrieval plausibility only.

### Suitability

This case is suitable for file-level evaluation only in v0.

## Case 003

### Source repo

- Repository: `lujakob/nestjs-realworld-example-app`
- Commit URL:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/7c7e385565f5ea23e5ee2735702124e1f0e8e2fa`
- Base commit:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/a0edadd2812bea5f1ad00e4074ffb048d80df105`

### PR / issue / commit links

- Public commit:
  `https://github.com/lujakob/nestjs-realworld-example-app/commit/7c7e385565f5ea23e5ee2735702124e1f0e8e2fa`
- No issue or pull request URL was recovered confidently from local git history,
  so the commit title is used as the requirement-text proxy:
  `fix: auth middleware user object`

### Why this case qualifies

- External public NestJS backend repository.
- The change targets authentication/user flow behavior.
- It is backend-only and scoped to middleware/controller/decorator/service logic.
- It is not a dependency-only, docs-only, or formatting-only change.

### Why excluded files are excluded

- DTO, module, and shared validation files are included only as broader
  candidates where they are plausible but not confirmed ground truth.
- Broader repository areas unrelated to auth/user flow were excluded from the
  candidate set because they would add noise without improving this first v0
  seed.

### Ground truth limitation statement

`groundTruth.files` reflects backend files changed in the public commit and is
used only as practical file-level proxy ground truth.

### Candidate artifact construction method

- Candidate artifacts were assembled manually from the pre-change `src/user`
  and `src/shared` tree.
- The set is broader than the changed files and includes plausible distractors
  such as DTO/module/validation files.

### Known threats to validity

- Requirement text is proxied from the commit title.
- Candidate universe is manually assembled.
- This does not support method-level claims.

### Suitability

This case is suitable for file-level evaluation only in v0.
