# Blinded Ground-Truth Review Packet

## Reviewer instruction

Review the source at commit
8fdabcbdd12cb5144199ad3ba7b93eaed0a20275 in
suites-dev/suites-unit. Do not open candidate-ground-truth.json or view any
BA_Helper analyzer output before returning your completed annotation template.
The candidate author did not certify these labels. Do not execute the external
repository.

For every test/target pair, independently classify the relationship as DIRECT,
INDIRECT, ABSENT, or UNRESOLVED. Record exact supporting source ranges,
assertion/invocation association, mock boundary, rationale, reviewer status,
and a pseudonymous reviewer code. “Unresolved” is appropriate when the source
does not support a more specific relationship. Do not infer execution,
coverage, or pass status.

Complete the blank file
tests/evaluation/developer-comprehension/annotation-template.csv. Return
corrections with the source evidence and rationale; preserve the original
candidate labels separately.

## Pinned source material

Repository: https://github.com/suites-dev/suites-unit

Commit: 8fdabcbdd12cb5144199ad3ba7b93eaed0a20275

License: Apache-2.0, verified from LICENSE and package.json at this commit.

Inspect these files directly at the pinned commit:

- DependencyContainer test:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/dependency-container.spec.ts
- DependencyContainer source:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/dependency-container.ts
- UnitMocker test:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/unit-mocker.spec.ts
- UnitMocker source:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/unit-mocker.ts
- UnitReference test:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/unit-reference.spec.ts
- UnitReference source:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/core/src/services/unit-reference.ts
- NestJS adapter Jest integration test:
  https://github.com/suites-dev/suites-unit/blob/8fdabcbdd12cb5144199ad3ba7b93eaed0a20275/packages/di/nestjs/__test__/nestjs-adapter.integration.test.ts

The packet covers direct method references, setup-mediated relationships,
parameterized declarations, test-controlled mocks, returned-value assertions,
an absent target/test pair, and an assertion-to-invocation association that
needs explicit adjudication.

## Review independence and disposition

The reviewer must not have authored the candidate labels or seen analyzer
predictions. Record reviewer identity only as a random code. A study coordinator
may reconcile disagreements after independent reviews are returned. Until
reviewers approve the labels, the data remains
PENDING_INDEPENDENT_REVIEW and cannot be used as accuracy ground truth.
