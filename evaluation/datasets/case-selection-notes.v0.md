# Case Selection Notes v0

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
It is not suitable for method-level accuracy claims yet.
