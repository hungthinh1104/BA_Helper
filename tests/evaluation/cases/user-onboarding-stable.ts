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
  'service-method:user-admin.service.deleteUser',
  'service-method:user-admin.service.exportUsers',
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
        'service-method:user.service.registerUser',
        'service-method:welcome-email.service.sendWelcomeEmail',
      ],
      impactedArtifactKeys: [
        'service-method:user.service.registerUser',
        'service-method:welcome-email.service.sendWelcomeEmail',
        'service-method:user-registered.handler.handleUserRegistered',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.service.registerUser', contains: 'registerUser' },
        { artifactKey: 'service-method:welcome-email.service.sendWelcomeEmail', contains: 'sendWelcomeEmail' },
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
        'service-method:user.repository.findByEmail',
        'service-method:user.service.registerUser',
      ],
      impactedArtifactKeys: [
        'service-method:user.repository.findByEmail',
        'service-method:user.service.registerUser',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.repository.findByEmail', contains: 'findByEmail' },
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
      criticalArtifactKeys: ['service-method:welcome-email.service.sendWelcomeEmail'],
      impactedArtifactKeys: [
        'service-method:welcome-email.service.sendWelcomeEmail',
        'service-method:user-registered.handler.handleUserRegistered',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:welcome-email.service.sendWelcomeEmail', contains: 'sendWelcomeEmail' },
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
        'api:user.controller.verifyEmail',
        'service-method:user.service.verifyEmail',
      ],
      impactedArtifactKeys: [
        'api:user.controller.verifyEmail',
        'service-method:user.service.verifyEmail',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'api:user.controller.verifyEmail', contains: 'verify' },
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
      criticalArtifactKeys: ['service-method:user-registered.handler.handleUserRegistered'],
      impactedArtifactKeys: [
        'service-method:user-registered.handler.handleUserRegistered',
        'service-method:user.service.registerUser',
        'service-method:welcome-email.service.sendWelcomeEmail',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user-registered.handler.handleUserRegistered', contains: 'handleUserRegistered' },
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
      criticalArtifactKeys: ['service-method:user.service.registerUser'],
      impactedArtifactKeys: [
        'service-method:user.service.registerUser',
        'service-method:user.repository.findByEmail',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.service.registerUser', contains: 'registerUser' },
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
      criticalArtifactKeys: ['service-method:user.service.verifyEmail'],
      impactedArtifactKeys: [
        'api:user.controller.verifyEmail',
        'service-method:user.service.verifyEmail',
        'service-method:user.repository.findByVerificationToken',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.repository.findByVerificationToken', contains: 'findByVerificationToken' },
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
      criticalArtifactKeys: ['service-method:welcome-email.service.sendWelcomeEmail'],
      impactedArtifactKeys: [
        'service-method:user.service.registerUser',
        'service-method:welcome-email.service.sendWelcomeEmail',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.service.registerUser', contains: 'registerUser' },
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
        'service-method:user.service.registerUser',
        'service-method:user.service.verifyEmail',
      ],
      impactedArtifactKeys: [
        'api:user.controller.verifyEmail',
        'service-method:user.service.registerUser',
        'service-method:user.service.verifyEmail',
        'service-method:user-registered.handler.handleUserRegistered',
        'service-method:welcome-email.service.sendWelcomeEmail',
      ],
      negativeArtifactKeys: NEGATIVES,
      requiredEvidenceAnchors: [
        { artifactKey: 'service-method:user.service.registerUser', contains: 'registerUser' },
        { artifactKey: 'service-method:user.service.verifyEmail', contains: 'verifyEmail' },
      ],
    },
    domain: DOMAIN,
  },
];
