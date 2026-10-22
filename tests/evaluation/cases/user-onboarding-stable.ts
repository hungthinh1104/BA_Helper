import type { EvaluationCase } from '../evaluation-types';

/**
 * Production-path stable evaluation cases for the nestjs-user-onboarding fixture.
 *
 * This fixture broadens taxonomy coverage beyond booking/order: it exercises a
 * repository, a validator, an external-integration email service, an event
 * handler, keyword-noise (audit), and explicit negatives (admin delete/export).
 *
 * Ground truth is calibrated against the real runtime pipeline output (scan →
 * retrieval → impact orchestration → deterministic fake AI), not hand-authored.
 * `impactedArtifactKeys` is the measured layer-1 (retrieval) set; committed
 * artifacts are a subset of it; `negativeArtifactKeys` are admin operations that
 * must never enter the committed / evidenced-claim layer.
 */

const FIXTURE = 'nestjs-user-onboarding';
const NEGATIVES = [
  'service-method:src%2Fadmin%2Fuser-admin.service.ts#UserAdminService.deleteUser~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
  'service-method:src%2Fadmin%2Fuser-admin.service.ts#UserAdminService.exportUsers~4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
];
const DOMAIN = { packId: 'general', expectedConceptKeys: [] as string[] };

export const userOnboardingEvaluationCases: EvaluationCase[] = [
  {
    id: 'prod-user-register',
    requirementTitle: 'Register a new user account',
    requirementText:
      'Update onboarding so registerUser enforces a unique email and persists the account, then triggers sendWelcomeEmail via handleUserRegistered.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
      ],
      impactedArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
        'service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907', contains: 'registerUser' },
        { artifactKey: 'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc', contains: 'sendWelcomeEmail' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-unique-email',
    requirementTitle: 'Reject duplicate email on registration',
    requirementText:
      'Registration must reject duplicates: the uniqueness check uses findByEmail before registerUser proceeds.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
      ],
      impactedArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'findByEmail' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-welcome-email',
    requirementTitle: 'Send welcome email after registration',
    requirementText:
      'After a successful registration, sendWelcomeEmail delivers the onboarding welcome email; it is invoked by handleUserRegistered.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: ['service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc'],
      impactedArtifactKeys: [
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
        'service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc', contains: 'sendWelcomeEmail' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-verify-email',
    requirementTitle: 'Verify a user email address',
    requirementText: 'When the verification token is confirmed, verifyEmail activates the account.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: [
        'api:src%2Fuser%2Fuser.controller.ts#UserController.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fuser%2Fuser.controller.ts#UserController.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'api:src%2Fuser%2Fuser.controller.ts#UserController.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'verify' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-registered-event',
    requirementTitle: 'Handle the user registered event',
    requirementText:
      'handleUserRegistered reacts to the user.registered event emitted by registerUser and calls sendWelcomeEmail.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: ['service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823'],
      impactedArtifactKeys: [
        'service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823', contains: 'handleUserRegistered' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-persist-account',
    requirementTitle: 'Persist the new user account',
    requirementText:
      'registerUser must persist the new pending-verification account and look up existing accounts with findByEmail.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: ['service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907'],
      impactedArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907', contains: 'registerUser' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-verify-token-lookup',
    requirementTitle: 'Resolve verification token on verify',
    requirementText: 'verifyEmail must resolve the account via findByVerificationToken and activate it.',
    targetFixture: FIXTURE,
    expected: {
      // findByVerificationToken is retrieved and evidenced (layer 1) but has no
      // adjudicated claim, so it stays out of the committed layer — exercising the
      // two-layer distinction.
      criticalArtifactKeys: ['service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371'],
      impactedArtifactKeys: [
        'api:src%2Fuser%2Fuser.controller.ts#UserController.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByVerificationToken~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.repository.ts#UserRepository.findByVerificationToken~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'findByVerificationToken' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-welcome-on-register',
    requirementTitle: 'Welcome email on successful registration',
    requirementText: 'A successful registerUser must lead to sendWelcomeEmail for the new account.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: ['service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc'],
      impactedArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907', contains: 'registerUser' },
      ],
    },
    domain: DOMAIN,
  },
  {
    id: 'prod-user-lifecycle',
    requirementTitle: 'Full registration and verification lifecycle',
    requirementText:
      'The lifecycle covers registerUser, then verifyEmail, with sendWelcomeEmail dispatched by handleUserRegistered.',
    targetFixture: FIXTURE,
    expected: {
      criticalArtifactKeys: [
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
      ],
      impactedArtifactKeys: [
        'api:src%2Fuser%2Fuser.controller.ts#UserController.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907',
        'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fevents%2Fuser-registered.handler.ts#UserRegisteredHandler.handleUserRegistered~ae3484e577c6f8e5d8c3e4c01fdcfff045e8a0e4628ba9602767a691ec472823',
        'service-method:src%2Femail%2Fwelcome-email.service.ts#WelcomeEmailService.sendWelcomeEmail~32b64d39f4c7d0026fcdbda88b73c36758405343e353d47ff14b659a5ae608dc',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:src%2Fuser%2Fuser.service.ts#UserService.registerUser~e3bea7a5b74640e4734fa0affe9b2d624c5a471974f866238d89239d1a65f907', contains: 'registerUser' },
        { artifactKey: 'service-method:src%2Fuser%2Fuser.service.ts#UserService.verifyEmail~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371', contains: 'verifyEmail' },
      ],
    },
    domain: DOMAIN,
  },
];
