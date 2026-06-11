/**
 * Booking Domain Profile
 *
 * Static configuration for the Booking/Payment/Refund domain.
 * Used to inject domain context into AI reasoning and to expand
 * retrieval search terms. NOT persisted in DB in MVP.
 *
 * See: docs/adr/0006-domain-profile-strategy.md
 */

export interface DomainProfile {
  /** Human-readable domain name */
  domain: string;

  /**
   * Short context paragraph injected into systemPrompt.
   * Keep concise — this is not a glossary dump.
   */
  promptContext: string;

  /**
   * Domain-specific risk categories injected into userPrompt as focus hints.
   * AI MUST ground any generated risk in retrieved Evidence.
   * These are hints, not automatic outputs.
   */
  riskCategories: string[];

  /**
   * Domain vocabulary used for lexical search expansion and artifact matching.
   * NOT injected into prompts directly.
   */
  glossary: string[];

  /**
   * Template questions a BA should validate for this domain.
   * Injected into report generation and BA question output.
   */
  questionTemplates: string[];

  /**
   * QA scenario templates specific to this domain.
   * Parameterized — filled in by AI based on evidence context.
   */
  qaScenarioTemplates: string[];

  /**
   * Report section ordering for this domain.
   * Core sections always present; domain-specific sections follow.
   */
  reportSections: string[];
}

export const BookingDomainProfile: DomainProfile = {
  domain: 'BOOKING',

  promptContext: `
    This analysis targets a booking, payment, and refund system.
    Key domain concerns include booking lifecycle state transitions,
    payment integrity, refund eligibility rules, and idempotency of
    financial operations. Policy rules govern which states allow cancellation
    and under what conditions a refund is triggered.
  `.trim(),

  riskCategories: [
    'Booking state machine violation (invalid transition)',
    'Double charge or duplicate payment processing',
    'Refund issued without valid cancellation record',
    'Payment not rolled back after failed booking',
    'Idempotency key missing or misused in payment/refund flow',
    'Race condition between concurrent booking/cancellation requests',
    'Stale booking data returned after state change',
    'Missing audit trail for financial state change',
    'Partial refund not handled correctly',
    'Notification not sent after cancellation/refund',
  ],

  glossary: [
    'booking',
    'reservation',
    'cancellation',
    'refund',
    'payment',
    'checkout',
    'confirmation',
    'availability',
    'slot',
    'schedule',
    'seat',
    'ticket',
    'invoice',
    'receipt',
    'transaction',
    'charge',
    'capture',
    'authorize',
    'void',
    'rollback',
    'idempotency',
    'booking status',
    'payment status',
    'refund status',
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'PAID',
    'REFUNDED',
    'FAILED',
  ],

  questionTemplates: [
    'What booking states allow cancellation?',
    'Is the refund amount always equal to the amount paid, or can it be partial?',
    'What happens if the refund payment gateway call fails — is the booking re-opened?',
    'Is there a time window after which cancellation is no longer allowed?',
    'Should a notification (email/SMS) be sent upon successful cancellation and refund?',
    'Does cancellation affect inventory/slot availability immediately or asynchronously?',
    'Who is authorized to cancel a booking — user, admin, or both?',
    'Is there a cooldown period before the same slot can be re-booked?',
    'How should concurrent cancellation requests for the same booking be handled?',
    'Are refund records stored separately from payment records for audit purposes?',
  ],

  qaScenarioTemplates: [
    'Cancel a CONFIRMED booking → verify state changes to CANCELLED and refund is initiated.',
    'Attempt to cancel an already CANCELLED booking → verify error is returned.',
    'Cancel booking when payment gateway is unavailable → verify booking state is not changed.',
    'Submit duplicate cancellation request with same idempotency key → verify only one refund is processed.',
    'Cancel booking outside allowed time window → verify rejection with appropriate message.',
    'Verify refund amount matches original payment amount.',
    'Verify slot/seat availability is restored after cancellation.',
    'Verify audit log entry is created for the cancellation event.',
    'Verify notification is sent to the user after successful refund.',
    'Cancel booking as unauthorized user → verify 403 is returned.',
  ],

  reportSections: [
    'Summary',
    'Affected Artifacts',
    'Evidence',
    'Domain Risks',
    'State Machine Impact',
    'Data Entity Impact',
    'Process Flow Changes',
    'Unknowns',
    'Stakeholder Questions',
    'Acceptance Criteria',
    'QA Scenarios',
    'Review Notes',
  ],
};
