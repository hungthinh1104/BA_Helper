# Static test trace evaluation

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
fails to diagnose cannot be counted. This corpus currently reports 0 diagnosed
unsupported declarations among 22 observed declarations and source evidence
integrity of 34/34 direct relationships. Symbol-only matching cannot pass if a
graded production symbol occurs in more than one selected file; candidate paths
are reported as an identity ambiguity.

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

For the visual trace question, compare the same application build and persisted
snapshot/report data with the trace panel visible or hidden by an operator's
study browser configuration. Keep all other evidence and review controls the
same. A comparison against an older, otherwise different build cannot isolate
the contribution of visual traces.

End timed review at the recorded decision/finalization before exposing report
appendices. If report reading is part of a timed task, the trace-hidden
condition must also hide saved traces and Markdown/PDF trace appendices;
hiding only the live panel would expose the same information elsewhere.

Assign matched tasks to the two conditions and counterbalance their order
across reviewers. Do not give one person the identical task twice and treat
the second attempt as an independent timing observation. Establish the
critical artifact and false-positive sets from source before exposing tool
output, then have a second reviewer adjudicate disagreements.

Record condition, task/repository commit, tool commit, elapsed time, correct
and missed impacts, false positives, and reviewer decisions. Include tasks
with mocked dependencies, absent references and parameterized declarations
with unexpanded or empty inline tables. Check whether reviewers distinguish a
source callback from generated/executed cases. Report per-task
results and uncertainty; a small pilot is not proof of product effectiveness.
