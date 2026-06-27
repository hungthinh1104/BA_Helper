import type { DomainPack } from '@ba-helper/contracts';

export const HealthcareDomainPack: DomainPack = {
  id: 'healthcare',
  name: 'Healthcare Admin Workflows',
  version: '0.1.0',
  status: 'PARTIAL',
  description: 'Partial domain pack for healthcare administrative workflows such as scheduling, records, billing, claims, and authorization.',
  glossaryMetadata: [
    {
      locale: 'en',
      status: 'foundation',
      version: '1.0.0',
      termCount: 8,
    },
    {
      locale: 'vi',
      status: 'foundation',
      version: '1.0.0',
      termCount: 8,
    },
  ],

  concepts: [
    {
      key: 'appointment_scheduling',
      label: 'Appointment Scheduling',
      aliases: ['appointment scheduling', 'appointment', 'reschedule appointment', 'visit scheduling'],
      relatedArtifactKeywords: ['appointment', 'schedule', 'reschedule', 'visit'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT', 'DATABASE_MODEL'],
    },
    {
      key: 'patient_record',
      label: 'Patient Record',
      aliases: ['patient record', 'patient profile', 'medical record', 'chart record'],
      relatedArtifactKeywords: ['patient-record', 'patient-profile', 'medical-record', 'chart'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'provider',
      label: 'Provider',
      aliases: ['provider', 'clinician', 'doctor', 'practitioner'],
      relatedArtifactKeywords: ['provider', 'clinician', 'doctor', 'practitioner'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'patient_notification',
      label: 'Patient Notification',
      aliases: ['patient notification', 'appointment reminder', 'patient reminder', 'notification'],
      relatedArtifactKeywords: ['notification', 'reminder', 'patient-message'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
    {
      key: 'insurance_claim',
      label: 'Insurance Claim',
      aliases: ['insurance claim', 'claim status', 'claim submission', 'payer claim'],
      relatedArtifactKeywords: ['insurance-claim', 'claim-status', 'payer-claim'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'billing_record',
      label: 'Billing Record',
      aliases: ['billing record', 'patient balance', 'invoice', 'payment record'],
      relatedArtifactKeywords: ['billing', 'invoice', 'patient-balance', 'payment-record'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'prior_authorization',
      label: 'Prior Authorization',
      aliases: ['prior authorization', 'preauthorization', 'authorization decision', 'authorization request'],
      relatedArtifactKeywords: ['prior-authorization', 'preauthorization', 'authorization'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'lab_order_tracking',
      label: 'Lab/Order Tracking',
      aliases: ['lab order', 'order tracking', 'order result', 'lab result'],
      relatedArtifactKeywords: ['lab-order', 'order-tracking', 'lab-result', 'order-result'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
  ],

  retrievalHints: [
    'appointment scheduling state transition',
    'patient record update audit trail',
    'provider patient notification workflow',
    'insurance claim status billing consistency',
    'prior authorization scheduling dependency',
    'lab order tracking result workflow',
  ],

  riskTemplates: [
    'PARTIAL healthcare admin hint: appointment state and provider availability may become inconsistent without source-backed transition evidence.',
    'PARTIAL healthcare admin hint: claim status changes may not update billing records or patient balance consistently.',
    'PARTIAL healthcare admin hint: prior authorization decisions may block scheduling or order workflows, but policy rules require source evidence.',
    'PARTIAL healthcare admin hint: this pack does not provide medical advice, clinical decision support, or compliance validation.',
  ],

  qaTemplates: [
    'PARTIAL healthcare admin hint: verify appointment rescheduling updates only source-backed appointment, availability, and notification behavior.',
    'PARTIAL healthcare admin hint: verify claim status changes keep billing records and patient balance consistent.',
    'PARTIAL healthcare admin hint: verify prior authorization approval and denial paths through scheduling or order workflows.',
  ],

  unknownTemplates: [
    'Which appointment states allow rescheduling and provider availability changes?',
    'Which claim statuses should update billing records or patient balance?',
    'Does prior authorization approval or denial block appointment scheduling or order fulfillment?',
    'Which patient/provider notifications are required by source-backed workflow rules?',
    'Are lab/order tracking workflows in scope for this healthcare admin profile revision?',
  ],
};
