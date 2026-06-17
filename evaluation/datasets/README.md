# Dataset v0 Notes

`cases.v0.json` is for public, reproducible ReqImpact evaluation cases.

## Data source rules

- Use public GitHub issue, PR, and commit cases only.
- Use changed files from those public cases as a practical proxy ground truth.
- Treat that ground truth as useful and reproducible, not as absolute truth.

## Candidate artifact rules

- `candidateArtifacts` must come from broad pre-change scanner output.
- Do not populate `candidateArtifacts` with only the ground-truth files.
- The point is to evaluate retrieval and ranking against a realistic candidate
  set, not against a pre-filtered answer key.

## Evaluation scope in v0

- File-level evaluation only.
- No method-level claims yet.
- `groundTruth.methods` may exist for future use, but v0 must not claim
  method-level accuracy unless a later phase measures it explicitly.

## Why this constraint exists

ReqImpact is being evaluated as an evidence-backed requirement-to-code impact
analysis artifact. If the candidate set is already narrowed to only true files,
retrieval metrics become meaningless and overstate performance.
