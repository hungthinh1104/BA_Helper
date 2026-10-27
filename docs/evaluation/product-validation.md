# Controlled-Beta Product Validation

This protocol measures whether BA Helper reduces analysis effort and
missed-impact risk for Technical BA and QC reviewers. It does not treat fixture
evaluation, automated tests, or model confidence as product-validation data.

The separate developer code-comprehension study (G2A) uses a different task
schema and protocol: [developer-comprehension-study.md](developer-comprehension-study.md).
It does not use BA analysis/report IDs and does not share the BA/QA scorecard.

The optional `studyObservations` array in the dataset template records the
three-condition comprehension study without storing participant identity:
`EXISTING_WORKFLOW`, `TEXTUAL_EVIDENCE`, and `VISUAL_TEST_TRACE`. Each row is
pinned to a case repository commit, tool commit, task, reviewer session code,
and timestamp. It records task correctness, confidence, elapsed time,
navigation actions, unsupported conclusions, usefulness, and voluntary reuse.
The scorecard reports `NOT_COLLECTED` when no observations exist and
`INCOMPLETE` until every one of the five tasks is represented in each of the
three conditions. It never converts missing participant observations into a
product success result.

## Case protocol

Use only public GitHub NestJS repositories pinned to an immutable 40-character
commit SHA. For each requirement:

1. Establish the critical impacted artifact set from source before exposing
   tool output; have another reviewer resolve disagreements.
2. Assign Existing Workflow, Textual Evidence, and Visual Test Trace conditions
   using matched tasks and counterbalance their order across reviewers. Record
   elapsed time, task correctness, confidence, navigation effort, and usefulness
   for each condition.
3. Avoid giving the same person an identical task twice as an independent
   timing comparison. Keep case-level observations and reviewer roles traceable
   without collecting reviewer identities.
4. The reviewer marks false-positive artifacts, useful unknowns, accepted QA
   scenarios, and confirmed evidence items.
5. When a rerun or drift result exists, the reviewer records whether it changed
   a decision or avoided repeated investigation.

Do not store reviewer names, emails, repository credentials, or private source
content in the dataset.

For the specific visual-trace comparison, use the protocol in
[static-test-trace.md](static-test-trace.md). The current version comparator
requires different tool commits; it does not score a same-build trace-visible
versus trace-hidden experiment. Keep those condition observations separately
and do not invent tool commits to make them fit a version comparison.

Each dataset identifies the exact BA Helper application version and 40-character
tool commit. Every case must reference its persisted `analysisId`, immutable
`reviewedReportSnapshotId`, and `reviewedAt` timestamp. Numbers without this
provenance are rejected instead of being accepted as product evidence.

## Metrics

The scorecard reports weighted aggregate values:

- analysis time reduction =
  `(manual minutes - assisted minutes) / manual minutes`
- critical impacted artifact recall =
  `critical artifacts found / critical artifacts expected`
- false-positive review burden =
  `false-positive artifacts / artifacts reviewed`
- useful unknown rate = `useful unknowns / unknowns reviewed`
- accepted QA scenario rate =
  `accepted QA scenarios / QA scenarios reviewed`
- reviewer-confirmed evidence rate =
  `confirmed evidence items / evidence items reviewed`
- rerun/drift usefulness =
  `useful rerun or drift reviews / rerun or drift reviews`

A denominator of zero produces `null`, never an invented zero or perfect score.
Counts are validated so accepted/found/useful values cannot exceed their
reviewed/expected totals.

For `studyObservations`, the scorecard reports per-condition task correctness,
behavior explanation, tested-behavior understanding, unseen-scenario
prediction, source-evidence identification, unsupported-conclusion rate,
confidence calibration gap, time to correct understanding, navigation actions,
usefulness, and voluntary reuse. These metrics are null when their denominator
is absent. A complete five-task, three-condition set is still a measurement
artifact, not causal proof from a small pilot.

## Running the scorecard

Copy `tests/product-validation/dataset.template.json` (a three-case scaffold —
the minimum for a decision) to a deliberately reviewed dataset file, replace all
placeholder values with real observations, then run:

```bash
pnpm validate:product-beta -- path/to/product-validation-dataset.json
```

The command writes
`artifacts/product-validation/scorecard.json`. Fewer than three cases produce
`INSUFFICIENT_CASES`; three all-zero placeholder cases produce
`INSUFFICIENT_OBSERVATIONS`; either status exits with code 2. Three cases with
real measured observations make the aggregate scorecard ready for a product
decision, but they do not automatically prove product success.
The scorecard's separate `study.status` remains `NOT_COLLECTED` or `INCOMPLETE`
until real observations cover all five tasks in all three conditions.

To evaluate a feature candidate against a prior baseline collected on the same
case scope, start the baseline from
`tests/product-validation/baseline.template.json` — it mirrors the candidate's
case scope with a different `tool.commitSha` and an earlier `collectedAt` — then
run:

```bash
pnpm validate:product-beta -- candidate.json baseline.json
```

This also writes `artifacts/product-validation/comparison.json`:

- `PROMOTE`: at least one observed metric improved beyond the 1 percentage
  point tolerance and none regressed.
- `DEFER`: no observed metric improved, or at least one metric regressed.
- `INCONCLUSIVE`: fewer than three cases, mismatched case scope, or a metric is
  observable in only one dataset.

Critical artifact recall has zero regression tolerance. Candidate and baseline
must use the same case IDs, repository commits, requirements, reviewer roles,
manual timings, and critical artifact ground truth. Metrics unavailable in both
datasets are reported as `NOT_OBSERVED` and are not silently converted to zero.
The candidate must identify a different tool commit and cannot have a collection
date earlier than the baseline.

The comparison also records candidate/baseline study status, observation count,
distinct condition/task cell count, case count, and reviewer-session count.
These values remain insufficient until all five tasks are represented in all
three reviewer-study conditions across at least three cases and three
non-identifying reviewer sessions.

## Phase 5 entry

SaaS work remains locked until a real comparison returns `PROMOTE`. Verify the
comparison artifact with:

```bash
pnpm verify:saas-entry -- artifacts/product-validation/comparison.json
```

This emits `artifacts/release/saas-entry.json`. The gate rejects insufficient
case counts, no measured improvement, any regression, identical tool commits,
incomplete reviewer-study condition/task cells, fewer than 15 observations or
distinct cells, fewer than three cases or sessions in either dataset, or a
`DEFER`/`INCONCLUSIVE` comparison.
A metric-only `PROMOTE` therefore cannot open SaaS entry.

## Decision rule

Establish thresholds only after the first reviewed baseline is collected.
Features that do not improve time, recall, review burden, useful unknowns,
accepted QA scenarios, confirmed evidence, or rerun/drift usefulness should be
deferred. Never tune or omit cases merely to improve the aggregate score.
