# Public static trace corpus

The original sample source files are unmodified, pinned excerpts from three external NestJS
repositories. Original paths, upstream Git blob hashes, selected cases and
expected relationships are recorded in
`tests/evaluation/public-test-trace.ground-truth.json`.

- `typescript-starter`: nestjs/typescript-starter at
  `c4d9330f5513eda0fb5df594f6b34a11fde1a934`. Its original README and package
  metadata declare MIT and reference the nestjs/nest license. The included
  LICENSE is that referenced license at the pinned framework commit below.
- `testing-nestjs`: jmcdo29/testing-nestjs at
  `47ab935278c662b5165e07f6783d395db047db2d`, complex cat sample. Original MIT
  license retained.
- `nest-sql-typeorm`: nestjs/nest at
  `d8ee0143bdd76b2e81b460a196c15a9387b73ee2`, SQL TypeORM user sample. Original
  MIT license retained.

No dependencies from these projects are installed and no fixture code is
executed. Imports outside the listed source selection remain unresolved.
Do not run package scripts in this corpus.

Expected relationships were authored by reading the source before the first
analyzer run. They have not been independently adjudicated by human reviewers.
The corpus contains samples, shares two repositories under the NestJS owner,
and covers only the listed source slices. It does not establish whole-project
impact accuracy, business policy correctness, or generalization to production
applications. New patterns need new source-audited cases, not rewritten labels
to match observed analyzer output.

## Application source slices added October 21

`tests/evaluation/application-test-trace.ground-truth.json` separately records
the source labels and exact blob pins for these unmodified files:

- `amplication-billing`: amplication/amplication at
  `7656495d27f0dceff89657590c3f14149e45c7a6`, billing and subscription services
  and tests, outside the enterprise directory. Original Apache 2.0 LICENSE
  retained; no upstream NOTICE file exists in the pinned repository tree.
- `novu-subscribers`: novuhq/novu at
  `3d5fb5ffb54405e0d94bb3f8ba4e2fb4b1a3ef2d`, subscriber get/remove use cases
  and a webhook removal factory example, all outside the enterprise directory.
  Original LICENSE-MIT and README explaining the license boundary retained.

The initial measurement was held out from resolver development. After the
measured fixes it becomes a regression corpus. The same no-execution and
selected-source limits above apply. Novu uses Mocha/Chai; its unbound describe/it
syntax exercises the parser's documented global syntax assumption and must not
be presented as verified Jest execution or framework identification.
