# Developer Comprehension Study Protocol

## Purpose and status

This protocol prepares a small study of evidence-backed code comprehension and
the additional value, if any, of Visual Test Trace. Both product hypotheses
remain unproven. This document, the task dataset, and automated scorecards are
engineering materials; none are participant observations.

The held-out candidate is suites-dev/suites-unit at commit
8fdabcbdd12cb5144199ad3ba7b93eaed0a20275. Its pinned LICENSE and package
metadata identify Apache-2.0. The repository is TypeScript, includes a NestJS
dependency-injection adapter, and uses Jest configuration and Jest tests. It is
a NestJS testing library rather than a booking/payment application, so results
must remain scoped to this codebase and must not be presented as application
generalization.

The audit and current readiness decision are recorded in
[g2a-completion-report.md](g2a-completion-report.md).

Candidate relationship labels are stored separately in
tests/evaluation/developer-comprehension/candidate-ground-truth.json and remain
PENDING_INDEPENDENT_REVIEW. A separate reviewer must approve or correct them
from the pinned source before this task pool is treated as study-ready. The
current dataset template has NOT_STARTED status and contains no participant
data.

## Conditions

Use the same repository commit, task text, tool build, selected code identity,
and underlying comprehension projection for every condition.

| Condition | Participant materials | BA Helper behavior |
| --- | --- | --- |
| EXISTING_WORKFLOW | Participant's normal IDE, repository search, source, tests, and one consistent AI assistant | BA Helper is unavailable |
| TEXTUAL_EVIDENCE | Existing workflow plus BA Helper's selected method, source evidence, static relationships, Jest declarations, assertions, mocks, and limitations | Use the studyCondition=TEXTUAL_EVIDENCE route; graph controls are hidden |
| VISUAL_TEST_TRACE | The same textual evidence plus graph interaction and evidence navigation | Use the studyCondition=VISUAL_TEST_TRACE route; graph controls are available |

The two BA Helper conditions call the same comprehension query with the same
snapshot and artifact. Condition metadata is not part of the query key or
evidence identity. TEXTUAL_EVIDENCE only hides graph interaction; it does not
change analyzer behavior or remove textual source facts. VISUAL_TEST_TRACE adds
the existing lazy-loaded graph presentation. The default Explorer remains
unchanged when no studyCondition is supplied. EXISTING_WORKFLOW displays an
instruction page and does not request code-comprehension data.

Do not expose saved trace appendices or other visual traces during the timed
TEXTUAL_EVIDENCE task. The operator supplies each participant's preassigned
fixed URL, opens the condition for that task, and records it in the observation.
Do not let participants change the URL or switch conditions during a timed task.
The B/C Explorer routes hide the in-app back link, and duplicate or unsupported
studyCondition values fail closed. The condition is still URL-based: removing
the parameter opens the ordinary Explorer, so the operator must keep the
assigned URL fixed for the duration of the task.

Use the same AI assistant and prompt policy in the existing-workflow condition
for all participants. Do not weaken normal IDE search or source navigation.

## Tasks and counterbalancing

The five participant prompts and pinned target identities are in
tests/evaluation/developer-comprehension/dataset.template.json. The answer key
is in developer-comprehension-answer-key.md and must not be shown during a task.

The families are:

1. Explain behavior, including branch conditions and dependencies.
2. Verify test evidence, including setup, invocation, assertions, and mocks.
3. Predict an unseen case and identify unresolved dependencies.
4. Prepare a safe narrow change and identify regression tests.
5. Verify a proposed claim against exact source evidence and uncertainty.

Use the following six-session schedule as the minimum counterbalanced pilot.
Each slot receives three different task families, one under each condition.
Across slots, each family appears in every condition, and the six condition
orders cover all permutations. S01-S06 are schedule slots, not participant
records or invented observations.

| Slot | EXISTING_WORKFLOW | TEXTUAL_EVIDENCE | VISUAL_TEST_TRACE | Condition order |
| --- | --- | --- | --- | --- |
| S01 | T1 | T2 | T3 | A, B, C |
| S02 | T2 | T3 | T4 | B, C, A |
| S03 | T3 | T4 | T5 | C, A, B |
| S04 | T4 | T5 | T1 | C, B, A |
| S05 | T5 | T1 | T2 | B, A, C |
| S06 | T1 | T2 | T3 | A, C, B |

Recruit approximately 6-8 developers familiar with TypeScript/NestJS and
unfamiliar with this repository. Do not give one person the same task under
multiple conditions. Use S07-S08 only with a documented schedule that preserves
task-family coverage and task-order balance. The six-slot schedule is a pilot
plan, not a simulated dataset.

Before recruitment, have reviewers who did not author the candidate labels
inspect task difficulty and expected answers. Match task complexity, number of
relevant methods, relationship depth, scenario count, mocks, and reasoning
steps. If reviewers cannot make the tasks sufficiently comparable, revise the
pool before running the study.

## Scoring

Score each applicable rubric dimension from 0 to 2:

- 0: incorrect or unsupported.
- 1: partly correct, but missing a material branch, source citation, or limit.
- 2: correct and supported by exact source locations.

Dimensions are behavior accuracy, source evidence, test semantics, uncertainty
recognition, and change safety. Not-applicable dimensions are null. The
task-specific required dimensions and answer notes are in the answer key.
TaskCorrect is set only after human rubric review; it is null for abandoned
tasks. A source citation must name a repository-relative path and line range.

Track correct task outcome, source-supported explanation, test/mocking
understanding, unseen-case prediction, and safe-change reasoning separately by
task family. Also report elapsed time, completion and abandonment, navigation
actions, confidence, unsupported claims, exact evidence identified, usefulness,
and voluntary reuse. Do not combine these into one accuracy figure or claim a
causal improvement from a small pilot.

## Observation format and privacy

Validate a real dataset with:

    pnpm validate:developer-study -- tests/evaluation/developer-comprehension/dataset.template.json

The standalone format exists because the BA/QA product-validation dataset
requires persisted impact-analysis and reviewed-report IDs, which do not apply
to this code-comprehension task. It keeps developer observations separate from
legacy BA/QA measures and does not create a second product analytics system.

Each observation records a pseudonymous session code, condition, task and case,
repository and tool commit SHAs, selected method, start/end and elapsed time,
submitted answer, rubric scores, confidence, evidence paths and lines,
unsupported claims, navigation effort, and completion/abandonment. Strict
schemas reject undeclared identity fields and require commit consistency.
Abandoned answers keep taskCorrect and confidence null; empty denominators
produce null metrics.

Use only public pinned repositories. Do not collect names, emails, repository
credentials, private source, or personal code. Answers and unsupported-claim
notes may quote the public study source. Keep the raw answer dataset restricted
to the study team and delete raw answers and evidence-identification details
90 days after the final study session; retain only the de-identified aggregate
scorecard after that date. Redact accidental personal information before
analysis and document the exclusion.

## Explicit status states

- NOT_STARTED: no participant observations have been collected.
- READY: independent ground truth is approved, the tool SHA is pinned, and the
  task materials and privacy instructions are frozen.
- IN_PROGRESS: at least one observation exists and collection is continuing.
- INSUFFICIENT_DATA: collection stopped without the minimum coverage; include a
  reason and report missing condition/task cells.
- COMPLETED: all 15 condition/task-family cells are present, at least three
  task cases are represented, at least six distinct sessions are recorded, and
  independent ground truth is approved.
- BLOCKED: a prerequisite prevents the study from proceeding; include the
  blocker.

The validator enforces status consistency. COMPLETED means collection met the
declared minimum; it does not mean the product hypotheses passed. At the time
this protocol was prepared, independent annotation was pending and no human
observations existed.
