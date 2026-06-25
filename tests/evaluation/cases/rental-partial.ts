import { EvaluationCase } from '../evaluation-types';

export const rentalPartialEvaluationCases: EvaluationCase[] = [
  {
    id: 'rental-partial-deposit-payment-consistency',
    requirementTitle: 'Update deposit payment for rental contract',
    requirementText:
      'When a tenant deposit payment is recorded, update the rental contract transition and payment record consistently.',
    targetFixture: 'nestjs-rental-partial',
    expected: {
      impactedArtifactKeys: [
        'api:rental-contract.controller.updateDeposit',
        'service-method:rental-contract.service.updateDepositPayment',
        'service-method:payment-record.service.recordDeposit',
        'entity:rentalcontract',
      ],
      negativeArtifactKeys: ['service-method:maintenance-request.service.openMaintenanceRequest'],
      evidenceHints: ['updateDepositPayment', 'recordDeposit', 'DEPOSIT_PAID'],
      unknownsOrQuestions: [
        'PARTIAL rental unknown: which contract states allow deposit updates?',
      ],
      risks: [
        'PARTIAL rental risk: deposit record and contract status may diverge without transactional guarantees.',
      ],
      qaScenarios: [
        'PARTIAL rental QA: record a tenant deposit and verify contract status and payment record source-backed changes.',
      ],
    },
    domain: {
      packId: 'rental',
      expectedConceptKeys: ['rental_contract', 'deposit', 'tenant', 'payment_record', 'contract_transition'],
    },
  },
  {
    id: 'rental-partial-room-availability-request-flow',
    requirementTitle: 'Update room availability for booking request',
    requirementText:
      'When a booking request reserves a room, update room availability through the booking request flow.',
    targetFixture: 'nestjs-rental-partial',
    expected: {
      impactedArtifactKeys: [
        'service-method:booking-request.service.markRoomUnavailableForRequest',
        'service-method:room-availability.service.updateAvailability',
      ],
      negativeArtifactKeys: ['service-method:maintenance-request.service.openMaintenanceRequest'],
      evidenceHints: ['markRoomUnavailableForRequest', 'updateAvailability'],
      unknownsOrQuestions: [
        'PARTIAL rental unknown: when does room availability become visible to other requests?',
      ],
      risks: [
        'PARTIAL rental risk: room availability may change before booking request state is settled.',
      ],
      qaScenarios: [
        'PARTIAL rental QA: reserve a room through a booking request and verify availability is updated from source evidence.',
      ],
    },
    domain: {
      packId: 'rental',
      expectedConceptKeys: ['room_availability', 'booking_request'],
    },
  },
  {
    id: 'rental-partial-contract-cancellation-effects',
    requirementTitle: 'Cancel rental contract with tenant and landlord notification',
    requirementText:
      'When a rental contract is cancelled, update contract transition, payment record, tenant notification, and landlord notification.',
    targetFixture: 'nestjs-rental-partial',
    expected: {
      impactedArtifactKeys: [
        'api:rental-contract.controller.cancel',
        'service-method:rental-contract.service.cancelContract',
        'service-method:payment-record.service.markContractCancelled',
        'service-method:tenant-notification.service.notifyTenantAndLandlord',
        'entity:rentalcontract',
      ],
      negativeArtifactKeys: ['service-method:maintenance-request.service.openMaintenanceRequest'],
      evidenceHints: ['cancelContract', 'markContractCancelled', 'notifyTenantAndLandlord'],
      unknownsOrQuestions: [
        'PARTIAL rental unknown: who must approve contract cancellation?',
      ],
      risks: [
        'PARTIAL rental risk: tenant or landlord notification may not match cancellation policy.',
      ],
      qaScenarios: [
        'PARTIAL rental QA: cancel a rental contract and verify source-backed payment record and notification effects.',
      ],
    },
    domain: {
      packId: 'rental',
      expectedConceptKeys: [
        'rental_contract',
        'tenant',
        'landlord',
        'payment_record',
        'contract_transition',
      ],
    },
  },
];
