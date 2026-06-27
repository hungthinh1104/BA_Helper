/**
 * Notification Domain Profile
 *
 * Deterministic hints for the Notification domain.
 * Used for retrieval glossary expansion and prompt context injection.
 */
import type { DomainProfile } from './booking.domain-profile';

export const NotificationDomainProfile: DomainProfile = {
  domain: 'NOTIFICATION',

  promptContext: `
    This analysis targets a notification and event messaging system.
    Key domain concerns include delivery reliability, event ordering,
    idempotency of notification dispatch, and handling delivery failures.
  `.trim(),

  riskCategories: [
    'Duplicate notification sent to same recipient',
    'Notification sent for wrong event or wrong recipient',
    'Notification delivery failure not retried',
    'Missing notification after critical state change',
    'Notification content contains stale or incorrect data',
    'Race condition between event dispatch and state commit',
    'Notification bypasses user communication preferences',
    'Email/SMS template rendering failure silently suppressed',
  ],

  glossary: [
    'notification',
    'email',
    'sms',
    'push',
    'alert',
    'event',
    'dispatch',
    'delivery',
    'webhook',
    'template',
    'recipient',
    'channel',
    'preference',
    'subscription',
    'unsubscribe',
    'idempotency',
    'retry',
    'queue',
    'SENT',
    'FAILED',
    'PENDING',
    'DELIVERED',
  ],

  questionTemplates: [
    'Which events trigger notifications and to which recipients?',
    'What happens if a notification delivery fails — is it retried?',
    'Are user notification preferences respected before dispatch?',
    'Is there a deduplication mechanism to prevent duplicate notifications?',
    'How are notification failures surfaced — silently logged or raised as alerts?',
    'Are notifications sent synchronously or asynchronously after state changes?',
  ],

  qaScenarioTemplates: [
    'Trigger booking cancellation → verify notification is sent to user.',
    'Send duplicate notification with same idempotency key → verify only one is delivered.',
    'Notification delivery fails → verify retry is queued and failure is logged.',
    'User has notifications disabled → verify no notification is dispatched.',
    'Verify notification content matches current booking/refund state.',
    'Verify audit log created for each notification dispatch attempt.',
  ],

  reportSections: [
    'Summary',
    'Affected Artifacts',
    'Evidence',
    'Domain Risks',
    'Notification Flow Impact',
    'Delivery Reliability',
    'Unknowns',
    'Stakeholder Questions',
    'Acceptance Criteria',
    'QA Scenarios',
    'Review Notes',
  ],
};
