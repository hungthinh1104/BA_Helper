import { EvaluationCase } from '../evaluation-types';

export const healthcarePartialEvaluationCases: EvaluationCase[] = [
  {
    id: 'healthcare-partial-appointment-reschedule',
    requirementTitle: 'Reschedule patient appointment and notify provider',
    requirementText:
      'When a patient appointment is rescheduled, update appointment scheduling, provider availability, and patient notification.',
    targetFixture: 'healthcare-admin-partial',
    expected: {
      impactedArtifactKeys: [
        'api:appointment.controller.reschedule',
        'service-method:appointment.service.rescheduleAppointment',
        'service-method:provider-availability.service.reserveSlot',
        'service-method:patient-notification.service.sendAppointmentReminder',
      ],
      negativeArtifactKeys: ['service-method:clinical-decision.service.recommendTreatment'],
      evidenceHints: ['rescheduleAppointment', 'reserveSlot', 'sendAppointmentReminder'],
      unknownsOrQuestions: [
        'PARTIAL healthcare admin unknown: which appointment states allow rescheduling?',
      ],
      risks: [
        'PARTIAL healthcare admin risk: appointment state and provider availability may diverge without source-backed transaction behavior.',
      ],
      qaScenarios: [
        'PARTIAL healthcare admin QA: reschedule an appointment and verify source-backed availability and notification effects.',
      ],
    },
    domain: {
      packId: 'healthcare',
      expectedConceptKeys: ['appointment_scheduling', 'provider', 'patient_notification'],
    },
  },
  {
    id: 'healthcare-partial-claim-status-billing',
    requirementTitle: 'Update insurance claim status and billing record',
    requirementText:
      'When an insurance claim status changes, update the billing record and patient balance notification.',
    targetFixture: 'healthcare-admin-partial',
    expected: {
      impactedArtifactKeys: [
        'api:claim.controller.updateStatus',
        'service-method:insurance-claim.service.updateClaimStatus',
        'service-method:billing-record.service.applyClaimAdjustment',
        'service-method:patient-notification.service.sendBillingNotice',
      ],
      negativeArtifactKeys: ['service-method:clinical-decision.service.recommendTreatment'],
      evidenceHints: ['updateClaimStatus', 'applyClaimAdjustment', 'sendBillingNotice'],
      unknownsOrQuestions: [
        'PARTIAL healthcare admin unknown: which claim statuses update patient balance?',
      ],
      risks: [
        'PARTIAL healthcare admin risk: claim status may update without billing record consistency evidence.',
      ],
      qaScenarios: [
        'PARTIAL healthcare admin QA: change a claim status and verify billing and patient notification source-backed behavior.',
      ],
    },
    domain: {
      packId: 'healthcare',
      expectedConceptKeys: ['insurance_claim', 'billing_record', 'patient_notification'],
    },
  },
  {
    id: 'healthcare-partial-prior-authorization-flow',
    requirementTitle: 'Apply prior authorization decision to order workflow',
    requirementText:
      'When prior authorization is approved or denied, update appointment scheduling or lab order tracking workflow and surface missing policy questions.',
    targetFixture: 'healthcare-admin-partial',
    expected: {
      impactedArtifactKeys: [
        'api:prior-authorization.controller.recordDecision',
        'service-method:prior-authorization.service.applyDecision',
        'service-method:lab-order.service.updateOrderHold',
      ],
      negativeArtifactKeys: ['service-method:clinical-decision.service.recommendTreatment'],
      evidenceHints: ['applyDecision', 'updateOrderHold'],
      unknownsOrQuestions: [
        'PARTIAL healthcare admin unknown: which authorization denial reasons block scheduling or order fulfillment?',
      ],
      risks: [
        'PARTIAL healthcare admin risk: authorization policy is not source-backed unless code links decision and order state.',
      ],
      qaScenarios: [
        'PARTIAL healthcare admin QA: approve and deny prior authorization and verify source-backed order/scheduling effects.',
      ],
    },
    domain: {
      packId: 'healthcare',
      expectedConceptKeys: ['prior_authorization', 'appointment_scheduling', 'lab_order_tracking'],
    },
  },
];
