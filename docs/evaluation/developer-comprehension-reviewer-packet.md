# Blinded Ground-Truth Review Packet

## Reviewer instructions

Review source at commit
`0c30a1828af52cf6528d0b3e9ddf86fc459723f6` in
`mutoe/nestjs-realworld-example-app`. Do not open
`candidate-ground-truth.json`, the candidate answer key, or BA_Helper analyzer
output before returning the completed annotation template. Do not execute the
external repository.

For every test/target pair in
`tests/evaluation/developer-comprehension/annotation-template.csv`, independently
classify the source relationship as DIRECT, INDIRECT, ABSENT, or UNRESOLVED.
Record exact source support, whether the relation is direct or setup/static-path
mediated, mock boundaries, assertion-to-invocation association, rationale, and
a random reviewer code. Do not infer test execution, passing status, runtime
coverage, or behavior hidden behind a mock.

Return the completed template and any disagreements with the source lines that
support your conclusion. The coordinator may reconcile labels after all
independent reviews are returned. Until approval is recorded, the dataset stays
`PENDING_INDEPENDENT_REVIEW` and cannot be used as accuracy ground truth.

## Pinned source

Repository: <https://github.com/mutoe/nestjs-realworld-example-app>

Commit: `0c30a1828af52cf6528d0b3e9ddf86fc459723f6`

License: MIT, verified from `LICENSE` and `package.json` at the pinned commit.

Inspect these files directly at that commit:

- AuthService production source: [auth.service.ts](https://github.com/mutoe/nestjs-realworld-example-app/blob/0c30a1828af52cf6528d0b3e9ddf86fc459723f6/src/auth/auth.service.ts)
- AuthService Jest source: [auth.service.spec.ts](https://github.com/mutoe/nestjs-realworld-example-app/blob/0c30a1828af52cf6528d0b3e9ddf86fc459723f6/src/auth/auth.service.spec.ts)
- AuthController production source: [auth.controller.ts](https://github.com/mutoe/nestjs-realworld-example-app/blob/0c30a1828af52cf6528d0b3e9ddf86fc459723f6/src/auth/auth.controller.ts)
- AuthController Jest source: [auth.controller.spec.ts](https://github.com/mutoe/nestjs-realworld-example-app/blob/0c30a1828af52cf6528d0b3e9ddf86fc459723f6/src/auth/auth.controller.spec.ts)
- Jest and package metadata: [package.json](https://github.com/mutoe/nestjs-realworld-example-app/blob/0c30a1828af52cf6528d0b3e9ddf86fc459723f6/package.json)

The sample includes direct method references, a static path through a mocked
service, multiple validation scenarios, assertions, mocked dependencies, a
negative control, and claims whose runtime/test status cannot be established
from source alone. Assess whether the selected tasks are sufficiently similar
in difficulty before any participant recruitment.
