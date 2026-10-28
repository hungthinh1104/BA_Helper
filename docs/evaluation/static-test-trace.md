# Static test trace evaluation

> Version scope: the TESTS/CALLS corpus figures in the first section are
> historical measurements from the analyzer versions named there. The current
> analyzer contract is `analyzer@0.16.0`; run the reproduction commands to
> produce a scorecard for the current checkout. Historical figures below do not
> certify current accuracy.

## Reproducible extraction pilot

Run `pnpm verify:public-test-trace`. This uses source slices from three public
repositories pinned to immutable commits, verifies their Git blob hashes, and
runs the real scanner and graph builder. It does not install dependencies or
execute the external projects. CI also runs this command and uploads its JSON
scorecard.

Ground truth was written from the source before evaluating the analyzer:
`tests/evaluation/public-test-trace.ground-truth.json`. It contains 22 Jest
cases, 24 direct TESTS references, and 10 CALLS references, including cases with
no method calls and assertion-only references to mocked methods. Every actual
relationship within this declared scope is graded; unexpected relationships
count as false positives. Empty denominators produce null metrics.

The recorded `analyzer@0.5.1` baseline is
`tests/evaluation/public-test-trace.baseline.json`: all cases and CALLS were
found, but all 24 TESTS references were missed. Source inspection identified
`TestingModule.get()` acquisition and setup-hook assignments as the common
cause. `analyzer@0.6.0` resolves these bounded patterns, with separate negative
tests for fake factories, string tokens, shadowing and conflicting writes.

The command writes `artifacts/evaluation/public-test-trace-scorecard.json`,
including the analyzer version, ground-truth digest, per-repository and
micro-aggregate precision, recall and F1, misses, unexpected relationships,
diagnostics, source-evidence integrity, observed unsupported declarations and
single-run scan/graph elapsed time. The source-evidence check verifies that
each emitted direct edge has a pinned source file, a reported line range inside
the source artifact, and the target method call at that location. This checks
trace provenance integrity; it does not independently establish business
relevance or prove that the test executes. The unsupported rate counts only
declarations explicitly reported by the parser; unsupported forms the parser
fails to diagnose cannot be counted. The recorded corpus run reported 0 diagnosed
unsupported declarations among 22 observed declarations and source evidence
integrity of 34/34 direct relationships. Symbol-only matching cannot pass if a
graded production symbol occurs in more than one selected file; candidate paths
are reported as an identity ambiguity.

## Static semantic behavior gate

The same command also evaluates the pinned fixture in
`tests/evaluation/semantic-test-behavior.ground-truth.json`. The fixture is
outside analyzer development fixtures and covers declared setup, a mock, a
static input, an action, assertions, expected outcomes, and diagnosed dynamic
or nested syntax. Each expected claim is anchored by exact source text and line;
the evaluator checks its full line/column span, source bytes, static evidence
kind, and fixture snapshot context. The fixture source hashes and content-derived
snapshot ID (SHA-256 over UTF-8 text with CRLF normalized to LF) prevent silent
input changes. Exact development-file, case-title,
and normalized test-body overlap checks guard against copying a development
fixture into the held-out set. Unsupported diagnostics have their own source anchors and are scored by
pattern, file, line, and column; the scan's fixture snapshot context is recorded
alongside them.

This is a small curated regression set, not an external accuracy estimate. The
labels are source-authored and frozen before evaluator execution, but they have
not received a second human review (`independentHumanReview: false`). CI status
means the current analyzer matches this frozen set; it does not certify broad
semantic accuracy. Add independently adjudicated repository cases before
making that claim. Static declarations never establish runtime execution,
coverage, test pass/fail, or business-rule correctness.

The behavior scorecard reports claim precision, recall and F1; unexpected and
missing claims; exact source/commit provenance integrity; unsupported-pattern
precision and recall; scan latency; and before/after RSS and heap observations.
Raw memory deltas are informational because the CI runner and garbage collector
affect them. The report does not gate on a noisy memory threshold. Unsupported
pattern recall covers only the labeled negative controls; syntax the parser
does not diagnose cannot enter that denominator.

## Graph scalability gate

CI runs `pnpm benchmark:static-test-graph -- ci`. It scans deterministic
synthetic repositories at 100, 200, and 800 test cases, verifies claim/edge
counts and repeat-run output digests, and records scan p50/p95 samples, graph
latency p50/p95 samples, process memory observations, analyzer version, and
implementation source hashes in `artifacts/performance/static-test-graph-ci.json`.
The existing per-scale first-scan and median-graph budgets remain regression
limits; p50/p95 values are retained to expose tail latency without silently
turning a small sample into a capacity guarantee. Memory observations are not
thresholds, and these generated repositories do not estimate end-to-end latency
or performance on arbitrary customer repositories.

The fixed pilot is a regression corpus after resolver development. Add new
application repositories as a held-out evaluation set before claiming broader
accuracy. This is not human-adjudicated ground truth or a measurement of
runtime test coverage, real-provider reasoning, or end-user review quality.

The next application source evaluation now exists separately in
[application-test-trace.md](application-test-trace.md). It preserves the first
`analyzer@0.6.0` measurement and its remaining accuracy gaps instead of merging
application results into the sample corpus's perfect regression score.

## Reviewer study preparation

Product validation remains unmeasured until real reviewers participate. Use
the existing Booking/Payment/Refund tasks and the provenance requirements in
`product-validation.md`; do not use fake-provider scorecards as observations.

For the visual trace question, compare three conditions on matched tasks:
`EXISTING_WORKFLOW`, `TEXTUAL_EVIDENCE`, and `VISUAL_TEST_TRACE`. Keep the same
application build, pinned snapshot/report data, and underlying evidence for the
last two conditions. A comparison against an older, otherwise different build
cannot isolate the contribution of visual traces.

End timed review at the recorded decision/finalization before exposing report
appendices. If report reading is part of a timed task, the trace-hidden
condition must also hide saved traces and Markdown/PDF trace appendices;
hiding only the live panel would expose the same information elsewhere.

Assign matched tasks to the three conditions and counterbalance their order
across reviewers. Cover the five comprehension tasks in each condition before
calling the study complete. Do not give one person the identical task twice and treat
the second attempt as an independent timing observation. Establish the
critical artifact and false-positive sets from source before exposing tool
output, then have a second reviewer adjudicate disagreements.

Record condition, task/repository commit, tool commit, elapsed time, correct
and missed impacts, false positives, and reviewer decisions. Include tasks
with mocked dependencies, absent references and parameterized declarations
with unexpanded or empty inline tables. Check whether reviewers distinguish a
source callback from generated/executed cases. Report per-task
results and uncertainty; a small pilot is not proof of product effectiveness.

### Lightweight paired study workflow

1. Select at least four booking/payment/refund change tasks with different
   impact shapes. Before the study, two reviewers independently label critical
   artifacts and false positives from the pinned source; resolve disagreements
   before calculating scores.
2. Freeze one tool build, requirement revision, repository snapshot, and report
   for all conditions. `EXISTING_WORKFLOW` exposes the reviewer's normal tools;
   `TEXTUAL_EVIDENCE` exposes structured evidence without the visual trace;
   `VISUAL_TEST_TRACE` exposes the same evidence through the trace panel. Hide
   saved trace appendices in the first two conditions.
3. Assign task order with a balanced sequence. Each reviewer sees a given task
   in only one condition; distribute matched tasks across reviewers so every
   task appears in all three conditions.
4. Start timing when the requirement and repository are shown. Stop at the
   recorded impact decision, before report appendices or ground truth are
   exposed. Record identified, missed, and false-positive artifact IDs, task
   accuracy, elapsed seconds, decision, and a 1–5 confidence rating.
5. Compare per-task accuracy and time by condition, show paired differences,
   confidence calibration, navigation effort, unsupported conclusions, and the
   number of reviewers/tasks. Retain disagreements and exclusions. For this
   BA/QC requirement-impact study, store each observation in the legacy
   `studyObservations` field with a non-identifying reviewer session code. The
   separate G2A developer-comprehension study uses its own dataset and
   scorecard; do not mix its observations into this BA/QA dataset.
   Do not combine this human result with analyzer precision/recall or present a
   small pilot as causal proof.

Use [reviewer-study-template.csv](reviewer-study-template.csv) for the blank
collection sheet. It contains no sample observations.
