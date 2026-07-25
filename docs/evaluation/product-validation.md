# Controlled-Beta Product Validation

This protocol measures whether BA Helper reduces analysis effort and
missed-impact risk for Technical BA and QC reviewers. It does not treat fixture
evaluation, automated tests, or model confidence as product-validation data.

## Case protocol

Use only public GitHub NestJS repositories pinned to an immutable 40-character
commit SHA. For each requirement:

1. A reviewer performs the analysis manually and records elapsed minutes.
2. The same reviewer performs the analysis with BA Helper and records elapsed
   minutes.
3. The reviewer establishes the critical impacted artifact set independently
   of the tool output.
4. The reviewer marks false-positive artifacts, useful unknowns, accepted QA
   scenarios, and confirmed evidence items.
5. When a rerun or drift result exists, the reviewer records whether it changed
   a decision or avoided repeated investigation.

Do not store reviewer names, emails, repository credentials, or private source
content in the dataset.

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

## Running the scorecard

Copy `tests/product-validation/dataset.template.json` outside the repository or
to a deliberately reviewed dataset file, replace all placeholder values with
real observations, then run:

```bash
pnpm validate:product-beta -- path/to/product-validation-dataset.json
```

The command writes
`artifacts/product-validation/scorecard.json`. Fewer than three complete cases
produce `INSUFFICIENT_CASES` and exit code 2. Three cases make the dataset ready
for a product decision; they do not automatically prove product success.

## Decision rule

Establish thresholds only after the first reviewed baseline is collected.
Features that do not improve time, recall, review burden, useful unknowns,
accepted QA scenarios, confirmed evidence, or rerun/drift usefulness should be
deferred. Never tune or omit cases merely to improve the aggregate score.

