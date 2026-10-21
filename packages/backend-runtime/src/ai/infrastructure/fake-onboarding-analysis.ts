/** Curated dev/test output, never an independent accuracy oracle. */
export function createFakeOnboardingAnalysis(userPrompt: string) {
  return {
    executiveSummary:
      'The onboarding flow registers a user via UserController.register and UserService.registerUser, enforces email uniqueness through EmailUniquenessValidator.validate, persists the account with UserRepository.save, and delivers a welcome email out of band via the user.registered event handler. The main risks are missing rate limiting on registration and unconfirmed verification-token expiry policy.',
    insights: [
      {
        insightKey: 'claim:register-route',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'A registration API route exists.',
        description:
          'UserController.register exposes the registration entrypoint.',
        evidenceKeys: ['api:user.controller.register'],
      },
      {
        insightKey: 'claim:register-service',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'UserService handles registration logic.',
        description:
          'UserService.registerUser orchestrates validation, persistence, and the registered event.',
        evidenceKeys: ['service-method:user.service.registerUser'],
      },
      {
        insightKey: 'claim:validate-email-unique',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Email uniqueness is validated during registration.',
        description:
          'EmailUniquenessValidator.validate rejects duplicate email registrations.',
        evidenceKeys: ['service-method:email-uniqueness.validator.validate'],
      },
      {
        insightKey: 'claim:persist-user',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'The new user account is persisted.',
        description: 'UserRepository.save writes the pending user account.',
        evidenceKeys: ['service-method:user.repository.save'],
      },
      {
        insightKey: 'claim:lookup-by-email',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Existing accounts are looked up by email.',
        description: 'UserRepository.findByEmail backs the uniqueness check.',
        evidenceKeys: ['service-method:user.repository.findByEmail'],
      },
      {
        insightKey: 'claim:send-welcome',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'A welcome email is sent on registration.',
        description:
          'WelcomeEmailService.sendWelcomeEmail delivers the onboarding welcome email.',
        evidenceKeys: ['service-method:welcome-email.service.sendWelcomeEmail'],
      },
      {
        insightKey: 'claim:registered-event-handler',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'The registered event triggers onboarding side effects.',
        description:
          'UserRegisteredHandler.handleUserRegistered reacts to the user.registered event.',
        evidenceKeys: [
          'service-method:user-registered.handler.handleUserRegistered',
        ],
      },
      {
        insightKey: 'claim:verify-route',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'An email verification route exists.',
        description:
          'UserController.verifyEmail exposes the verification entrypoint.',
        evidenceKeys: ['api:user.controller.verifyEmail'],
      },
      {
        insightKey: 'claim:verify-service',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'UserService activates the account on verification.',
        description:
          'UserService.verifyEmail moves the account to ACTIVE once the token is confirmed.',
        evidenceKeys: ['service-method:user.service.verifyEmail'],
      },
      {
        insightKey: 'question:token-expiry',
        insightType: 'QUESTION',
        certainty: 'UNKNOWN',
        confidence: null,
        title: 'What is the verification-token expiry policy?',
        description:
          'How long a verification token remains valid is not evidenced in the code.',
        reasoning:
          'The verification route is evidenced, but no expiry/TTL policy was found.',
        evidenceKeys: ['api:user.controller.verifyEmail'],
      },
      {
        insightKey: 'ac:register-persists-pending-user',
        insightType: 'ACCEPTANCE_CRITERIA',
        certainty: 'INFERRED',
        confidence: 0.82,
        title:
          'Registration persists a pending-verification user and sends a welcome email.',
        description:
          'Given a unique email, when a user registers, then a PENDING_VERIFICATION account is saved and a welcome email is dispatched.',
        reasoning:
          'Derived from the registration change request and the evidenced persistence + email side effects.',
        evidenceKeys: [
          'service-method:user.service.registerUser',
          'service-method:welcome-email.service.sendWelcomeEmail',
        ],
        relatedArtifactKeys: ['service-method:user.repository.save'],
      },
      {
        insightKey: 'qa:duplicate-email-rejected',
        insightType: 'QA_SCENARIO',
        certainty: 'INFERRED',
        confidence: 0.78,
        title: 'Duplicate email registration is rejected.',
        description:
          'Verify that registering an already-used email is rejected by the uniqueness validator.',
        reasoning:
          'The uniqueness validator and email lookup are both in the evidence scope.',
        evidenceKeys: [
          'service-method:email-uniqueness.validator.validate',
          'service-method:user.repository.findByEmail',
        ],
        given: 'an account already exists for the email',
        when: 'a new registration is submitted with the same email',
        then: 'the registration is rejected with a conflict and no second account is created',
      },
    ].filter(
      (insight) =>
        insight.evidenceKeys.length === 0 ||
        insight.evidenceKeys.some((key) => userPrompt.includes(key)),
    ),
    unknowns: [
      {
        insightKey: 'unknown:registration-rate-limit',
        description:
          'Registration rate limiting is not confirmed from code evidence.',
        reasoning:
          'No throttling or rate-limit guard was found on the registration route.',
      },
      {
        insightKey: 'unknown:verification-token-expiry',
        description:
          'Verification token expiry is not confirmed from code evidence.',
        reasoning:
          'No token TTL or expiry check was found in the verification flow.',
      },
      {
        insightKey: 'unknown:password-policy',
        description:
          'Password strength policy is not confirmed from code evidence.',
        reasoning:
          'Registration accepts a pre-hashed password with no evidenced strength policy.',
      },
    ],
    qaScenarios: [],
  };
}
