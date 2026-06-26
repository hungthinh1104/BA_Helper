/**
 * Refund Domain Profile
 *
 * Deterministic hints for the Refund domain.
 * Used for retrieval glossary expansion and prompt context injection.
 */
import { DomainProfile } from './booking.domain-profile';

export const RefundDomainProfile: DomainProfile = {
  domain: 'REFUND',

  promptContext: `
    This analysis targets a refund and reversal system.
    Key domain concerns include refund eligibility rules, refund idempotency,
    partial refund handling, ledger consistency, and failed reversal recovery.
  `.trim(),

  riskCategories: [
    'Double refund — same booking refunded more than once',
    'Inconsistent refund ledger — refund recorded without gateway confirmation',
    'Failed reversal not retried — customer charged but refund never issued',
    'Partial refund amount mismatch with original charge',
    'Refund issued for non-refundable bookings',
    'Refund processed after cancellation policy window',
    'Missing idempotency check on refund endpoint',
    'Race condition between concurrent refund requests',
    'Refund notification not sent after successful reversal',
    'Audit trail missing for refund state transitions',
  ],

  glossary: [
    'refund',
    'reversal',
    'compensation',
    'refund status',
    'partial refund',
    'full refund',
    'refundable',
    'non-refundable',
    'refund eligibility',
    'cancellation policy',
    'REFUNDED',
    'REFUND_PENDING',
    'REFUND_FAILED',
    'reversal',
    'credit',
    'chargeback',
    'idempotency',
    'ledger',
    'reconciliation',
  ],

  questionTemplates: [
    'Under what conditions is a refund automatically triggered upon cancellation?',
    'Is the refund amount always equal to the amount paid, or can it be partial?',
    'What happens if the refund gateway call fails — is it retried automatically?',
    'Is there a maximum number of refund retries before manual intervention is required?',
    'Are partial refunds supported and how is the remaining balance tracked?',
    'How is the refund ledger kept consistent with the payment gateway state?',
    'Who receives notification upon successful or failed refund — user, finance, or both?',
    'Are refund records stored separately from payment records for audit purposes?',
  ],

  qaScenarioTemplates: [
    'Cancel a CONFIRMED booking → verify refund is initiated and status changes to REFUNDED.',
    'Submit duplicate refund request with same idempotency key → verify only one reversal is processed.',
    'Refund gateway call fails → verify booking status is not altered and retry is queued.',
    'Attempt partial refund → verify refund amount matches expected partial amount.',
    'Attempt refund on a non-refundable booking → verify rejection with appropriate message.',
    'Verify refund ledger entry created and amount matches original charge.',
    'Verify audit log entry is created for each refund state transition.',
    'Verify user notification sent after successful refund.',
    'Attempt refund after cancellation policy window → verify rejection.',
  ],

  reportSections: [
    'Summary',
    'Affected Artifacts',
    'Evidence',
    'Domain Risks',
    'Refund Flow Impact',
    'Ledger Consistency',
    'Unknowns',
    'Stakeholder Questions',
    'Acceptance Criteria',
    'QA Scenarios',
    'Review Notes',
  ],
};
