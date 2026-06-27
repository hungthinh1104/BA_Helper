/**
 * Payment Domain Profile
 *
 * Deterministic hints for the Payment domain.
 * Used for retrieval glossary expansion and prompt context injection.
 */
import type { DomainProfile } from './booking.domain-profile';

export const PaymentDomainProfile: DomainProfile = {
  domain: 'PAYMENT',

  promptContext: `
    This analysis targets a payment processing system.
    Key domain concerns include transaction integrity, charge/capture sequencing,
    payment gateway error handling, idempotency of payment operations, and
    consistency between payment status and external gateway state.
  `.trim(),

  riskCategories: [
    'Duplicate payment or double charge',
    'Inconsistent payment status between internal DB and payment gateway',
    'Missing rollback after partial payment failure',
    'Idempotency key missing or reused incorrectly',
    'Race condition in concurrent payment attempts',
    'Payment captured without authorization',
    'Missing audit trail for payment state changes',
    'Retry storm causing multiple charges',
    'Silent failure — payment fails but no error is surfaced',
    'Charge processed for expired or revoked authorization',
  ],

  glossary: [
    'payment',
    'transaction',
    'charge',
    'capture',
    'authorize',
    'void',
    'invoice',
    'receipt',
    'paid',
    'failed',
    'pending payment',
    'payment status',
    'payment gateway',
    'idempotency key',
    'retry',
    'settlement',
    'acquirer',
    'merchant',
    'refund',
    'chargeback',
    'PENDING',
    'PAID',
    'FAILED',
    'CANCELLED',
  ],

  questionTemplates: [
    'What happens if the payment gateway returns a timeout — is the charge retried?',
    'How is idempotency enforced to prevent duplicate charges on retry?',
    'Is there a reconciliation process between internal payment state and the gateway?',
    'What payment states allow a refund to be initiated?',
    'Are failed payments surfaced to users immediately or after a retry window?',
    'Who is notified when a payment fails — user, admin, or both?',
    'Are partial payments supported, and how is the remaining balance tracked?',
    'Is there a maximum retry count for failed payment attempts?',
  ],

  qaScenarioTemplates: [
    'Submit payment successfully → verify transaction record created and status is PAID.',
    'Submit duplicate payment with same idempotency key → verify only one charge is processed.',
    'Payment gateway times out → verify payment status remains PENDING and no charge is recorded.',
    'Payment fails → verify user is notified and booking/order status remains unchanged.',
    'Retry a failed payment → verify exactly one successful charge upon successful retry.',
    'Void an authorized payment → verify no charge is captured.',
    'Unauthorized payment attempt → verify 403 is returned.',
    'Verify audit log created for each payment state transition.',
  ],

  reportSections: [
    'Summary',
    'Affected Artifacts',
    'Evidence',
    'Domain Risks',
    'Payment Flow Impact',
    'Idempotency Analysis',
    'Unknowns',
    'Stakeholder Questions',
    'Acceptance Criteria',
    'QA Scenarios',
    'Review Notes',
  ],
};
