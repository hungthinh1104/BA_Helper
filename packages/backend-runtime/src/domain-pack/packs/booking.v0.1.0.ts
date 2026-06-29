import type { DomainPack } from '@ba-helper/contracts';

export const BookingDomainPack: DomainPack = {
  id: 'booking',
  name: 'Booking',
  version: '0.1.0',
  status: 'STABLE',
  description: 'Core domain pack for booking, payment, and refund lifecycle systems.',
  glossaryMetadata: [
    {
      locale: 'en',
      status: 'foundation',
      version: '1.0.0',
      termCount: 6,
    },
    {
      locale: 'vi',
      status: 'foundation',
      version: '1.0.0',
      termCount: 6,
    },
  ],
  
  concepts: [
    {
      key: 'booking',
      label: 'Booking',
      aliases: ['booking', 'reservation', 'slot', 'seat', 'ticket', 'schedule'],
      relatedArtifactKeywords: ['booking', 'reservation', 'schedule', 'appointment', 'availability'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'payment',
      label: 'Payment',
      aliases: ['payment', 'checkout', 'transaction', 'charge', 'capture', 'authorize', 'invoice'],
      relatedArtifactKeywords: ['payment', 'checkout', 'transaction', 'invoice', 'billing'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'refund',
      label: 'Refund',
      aliases: ['refund', 'repayment', 'money back', 'void', 'rollback'],
      relatedArtifactKeywords: ['refund', 'repayment', 'void', 'rollback', 'wallet'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'cancellation',
      label: 'Cancellation',
      aliases: ['cancellation', 'cancel', 'revoke', 'abort'],
      relatedArtifactKeywords: ['cancel', 'cancellation', 'revoke'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
    {
      key: 'notification',
      label: 'Notification',
      aliases: ['notification', 'email', 'sms', 'alert', 'message'],
      relatedArtifactKeywords: ['notification', 'email', 'sms', 'mailer', 'alert'],
      relatedKinds: ['SERVICE', 'EVENT_HANDLER'],
    },
  ],

  retrievalHints: [
    'booking state transition',
    'payment processing',
    'refund eligibility',
    'idempotency key',
    'financial rollback',
    'notification trigger',
  ],

  riskTemplates: [
    'Booking state machine violation (e.g., invalid transition from cancelled to confirmed)',
    'Double charge or duplicate payment processing for the same booking',
    'Refund issued without a valid and matching cancellation record',
    'Payment not rolled back or voided after a failed booking attempt',
    'Idempotency key missing or misused in the payment/refund flow',
    'Race condition between concurrent booking and cancellation requests',
    'Notification not sent or sent incorrectly after cancellation/refund',
    'Stale booking data returned after a state change',
    'Missing audit trail for financial state change',
    'Partial refund not handled correctly',
  ],

  qaTemplates: [
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

  unknownTemplates: [
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
};
