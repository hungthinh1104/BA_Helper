# nestjs-user-onboarding fixture

A pinned NestJS + TypeORM fixture for the analyzer quality gate. It exercises a
**user registration / onboarding** flow with a broader artifact taxonomy than the
booking and order fixtures:

- **Controller** — `UserController.register`, `UserController.verifyEmail`
- **Service** — `UserService.registerUser`, `UserService.verifyEmail`
- **Repository** — `UserRepository.save`, `UserRepository.findByEmail`
- **Validator** — `EmailUniquenessValidator.validate`
- **External integration** — `WelcomeEmailService.sendWelcomeEmail`
- **Event handler** — `UserRegisteredHandler.handleUserRegistered`
- **Keyword-noise** — `AuditService.recordActivity` (mentions "register"/"user"
  but is not a primary impact of onboarding change requests)
- **Explicit negatives** — `UserAdminService.deleteUser`, `UserAdminService.exportUsers`
  (must never enter the committed / evidenced-claim set for onboarding requirements)

Ground truth for the evaluation cases is calibrated against the real runtime
pipeline output, not hand-authored expectations.
