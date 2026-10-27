# Developer Comprehension Candidate Answer Key

This document is for human rubric reviewers only. Do not show it to
participants before their task is complete. It is a source-authored candidate
key, not independent human adjudication. Use the exact repository commit in the
dataset and recheck every line after any source change.

## T1: Explain DependencyContainer.resolve

Expected findings:

- The implementation filters registrations by strict identifier equality
  (dependency-container.ts lines 35-38).
- No matching registration returns undefined (lines 40-42).
- One matching registration with omitted metadata returns its value (lines
  44-46); this branch does not compare the registered metadata.
- When metadata is supplied, the method searches using deep strict equality
  (lines 48-56).
- Duplicate registrations without matching metadata do not select an arbitrary
  matching value; the method returns undefined after the metadata search.
- Relevant declarations include the duplicate-token, absent-token, mismatched
  metadata, matched metadata, and missing-metadata test cases in
  dependency-container.spec.ts lines 20-89.

Required rubric dimensions: behavior accuracy and source evidence.

## T2: Verify UnitMocker test evidence

Expected findings:

- The test setup creates a UnitMocker with a factory returning a test marker and
  an adapter exposing an injectable registry (unit-mocker.spec.ts lines 90-95).
- An advanced mocks container is configured at lines 100-104.
- constructUnit is invoked in the nested beforeAll at lines 106-109, outside
  the body of the test titled “should stay mocked”.
- That test asserts resolved values at lines 137-140. The property-mock test
  asserts injected properties at lines 143-149.
- The production method delegates dependency resolution to DependencyResolver,
  instantiates the target class, and returns a container, instance, and
  resolution summary (unit-mocker.ts lines 24-46).
- These are static declarations. Source and declarations alone do not show
  that Jest ran or that the assertions passed.

Required rubric dimensions: source evidence, test semantics, and uncertainty
recognition. Full credit identifies the configured mock boundary.

## T3: Predict UnitReference.get without metadata

Expected findings:

- UnitReference.get normalizes the identifier, checks fake and exposed
  dependencies, then calls mocksContainer.resolve with the identifier and
  optional metadata (unit-reference.ts lines 173-195).
- The setup registers DEPENDENCY_TWO once with metadata dependency=two
  (unit-reference.spec.ts lines 31-34).
- DependencyContainer.resolve returns the sole registration when the caller
  omits metadata (dependency-container.ts lines 35-46). Therefore the
  candidate source prediction is DependencyTwoStubbed.
- The declared parameterized tests cover other single identifiers without
  metadata; the metadata-specific test supplies metadata at
  unit-reference.spec.ts lines 76-86. The exact DEPENDENCY_TWO call with
  omitted metadata is not declared as a test case.
- The prediction is source-supported, but it is not an observed runtime result.

Required rubric dimensions: behavior accuracy, source evidence, and uncertainty
recognition.

## T4: Prepare a safe narrow change

Expected findings:

- Identify UnitMocker.constructUnit and the DependencyResolver path it creates
  (unit-mocker.ts lines 24-46).
- Existing advanced mocks are prepared in unit-mocker.spec.ts lines 100-104.
- Existing declarations check preserved constructor/container resolutions at
  lines 137-140 and property injections at lines 143-149.
- A safe test plan should preserve exact token and metadata identity and cover
  both constructor and property injection. It should include a case where an
  explicit value conflicts with the generated mock and assert both the returned
  container and injected instance.
- Do not claim an uncovered scenario is a production defect until the reviewer
  confirms the intended precedence rule. Do not implement code during this task.

Required rubric dimensions: source evidence, test semantics, and change safety.

## T5: Verify the claim

Claim: “The missing-identifier test proves UnitReference.get throws in a
passing test.”

Expected findings:

- The test declaration calls get with a missing string identifier and declares
  a toThrowError assertion (unit-reference.spec.ts lines 88-92).
- The implementation throws DependencyResolutionError when the dependency
  container returns no value (unit-reference.ts lines 195-200).
- The source supports the expected behavior and the test's declared assertion.
- The word “passing” is unsupported without a recorded execution result. Static
  source cannot establish that the test ran or passed.

Required rubric dimensions: source evidence, test semantics, and uncertainty
recognition.

## Shared scoring guidance

For each required dimension, award 2 only when the response is correct and
gives exact supporting source paths and line ranges. Award 1 for a correct but
materially incomplete response. Award 0 for a false or unsupported conclusion.
An incorrect claim that a test passed is an uncertainty-recognition error even
when its asserted behavior matches the source.
