# Developer Comprehension Candidate Answer Key

For rubric reviewers only. Do not show this file during a participant task or to
the blinded ground-truth reviewer before they return the annotation template.
This is a candidate key based on pinned source, not independent adjudication.

Repository: `mutoe/nestjs-realworld-example-app`
Commit: `0c30a1828af52cf6528d0b3e9ddf86fc459723f6`

## T1: Explain AuthService.validateUser

Expected findings:

- It asks `UserService.findUser` for the email and requests the password-bearing
  record (auth.service.ts lines 39-40).
- Missing user throws `BadRequestException('user is not exist')` (lines 41-43).
- A password mismatch after `cryptoPassword(password)` throws
  `BadRequestException('password is invalid')` (lines 44-46).
- Otherwise it returns the user with `password` omitted (line 47).
- Jest declarations cover a valid result, absent user, and invalid password
  (auth.service.spec.ts lines 86-109). `findUser` is stubbed in each case.
- The declarations are source; they do not establish that Jest ran or passed.

Required rubric dimensions: behavior accuracy, source evidence, and uncertainty
recognition.

## T2: Verify AuthService.login test evidence

Expected findings:

- The test spies on `validateUser` and `generateToken`, then calls
  `authService.login` (auth.service.spec.ts lines 72-79).
- It checks that the returned object omits `password` and includes the supplied
  profile marker and token (lines 80-82).
- The production method awaits validation, generates a token from user id and
  email, and returns both (auth.service.ts lines 33-37).
- The test-controlled spies mean this declaration does not establish the
  implementation of password validation or JWT signing.
- It does not establish test execution or pass status.

Required rubric dimensions: source evidence, test semantics, and uncertainty
recognition.

## T3: Predict AuthController.login when the service rejects

Expected findings:

- The controller awaits `authService.login` and wraps a resolved profile under
  `user` (auth.controller.ts lines 25-29).
- There is no local catch/translation in this method. From the async source, a
  rejected service promise rejects the controller promise; HTTP adapter behavior
  is not established by this method alone.
- The controller test spies on `authService.login` with `mockResolvedValue`,
  calls the controller, and checks the response shape
  (auth.controller.spec.ts lines 64-74).
- That declaration does not exercise rejection. Its service call is a mock
  boundary, despite the static source call path.
- Do not state that the rejection case was executed or that Jest passed.

Required rubric dimensions: behavior accuracy, source evidence, and uncertainty
recognition.

## T4: Prepare a safe registration change

Expected findings:

- `register` checks username first, then email, before calling `createUser` and
  generating a token (auth.service.ts lines 18-30).
- Existing declarations cover a successful registration, duplicate username,
  and duplicate email (auth.service.spec.ts lines 42-69).
- The duplicate-email test stubs `findUser` to return no username match and then
  an existing email match (lines 62-68); it asserts the exception, but does not
  assert that `createUser` or `generateToken` was not called.
- A safe plan adds explicit no-side-effect assertions for both duplicate paths,
  while preserving the successful path and verifying the ordered lookups.
- Treat the requested behavior as the task requirement, not as proof of an
  existing production defect.

Required rubric dimensions: source evidence, test semantics, and change safety.

## T5: Verify the token claim

Claim: “The generateToken Jest test proves the service returns a valid signed
JWT.”

Expected findings:

- The method delegates to `jwtService.sign({ userId, email })`
  (auth.service.ts lines 50-52).
- The testing module provides a `JwtService` mock whose `sign` returns the
  literal `token` (auth.service.spec.ts lines 26-31).
- The declaration invokes `generateToken` and asserts that its result is the
  literal `token` (lines 113-117).
- The source and declaration support the static delegation and declared return
  value. They do not establish a cryptographically valid JWT, a test execution,
  or a passing run.

Required rubric dimensions: source evidence, test semantics, and uncertainty
recognition.

## Shared scoring guidance

Score each applicable dimension from 0 to 2. Give 2 only for a correct answer
with exact source references; give 1 for a partly correct answer missing a
material branch or limit; give 0 for an incorrect or unsupported conclusion.
Treat a claim that a test passed without execution evidence as an uncertainty
recognition error. Keep correctness, confidence, time, and usefulness separate.
