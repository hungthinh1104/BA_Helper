/**
 * Unknown Domain Profile
 *
 * Safe fallback profile when domain is unrecognized or not provided.
 * Contains minimal generic hints that apply broadly without
 * biasing retrieval toward any specific domain.
 *
 * Rules:
 * - glossary is intentionally minimal to avoid false domain boosting.
 * - riskCategories are generic engineering risks.
 * - qaScenarioTemplates are generic smoke-test patterns.
 * - This profile must never throw or cause diagnostic failures.
 */
import { DomainProfile } from './booking.domain-profile';

export const UnknownDomainProfile: DomainProfile = {
  domain: 'UNKNOWN',

  promptContext: `
    This analysis targets a system with an unrecognized or unspecified domain.
    Apply generic engineering best practices. Flag any domain-specific assumptions
    as unknowns requiring stakeholder clarification.
  `.trim(),

  riskCategories: [
    'Unhandled error path causing silent failure',
    'Inconsistent state between service and persistence layer',
    'Missing idempotency protection on state-mutating operations',
    'Missing audit trail for critical state changes',
    'Race condition in concurrent request handling',
    'Authorization check missing or incorrectly scoped',
  ],

  glossary: [
    'status',
    'state',
    'event',
    'service',
    'repository',
    'controller',
    'handler',
    'workflow',
  ],

  questionTemplates: [
    'What are the primary domain entities and their lifecycle states?',
    'What are the key state transitions that must be validated?',
    'Are there idempotency requirements for any operations?',
    'Are audit logs required for state-changing operations?',
    'Who is authorized to perform each operation?',
  ],

  qaScenarioTemplates: [
    'Perform the primary operation → verify expected state change occurs.',
    'Repeat the same operation → verify idempotency is respected.',
    'Perform operation as unauthorized user → verify rejection.',
    'Verify audit log created for the state-changing operation.',
  ],

  reportSections: [
    'Summary',
    'Affected Artifacts',
    'Evidence',
    'Domain Risks',
    'Unknowns',
    'Stakeholder Questions',
    'Acceptance Criteria',
    'QA Scenarios',
    'Review Notes',
  ],
};
