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
        'api:src%2Frental-contract%2Frental-contract.controller.ts#RentalContractController.updateDeposit~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Frental-contract%2Frental-contract.service.ts#RentalContractService.updateDepositPayment~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment-record.service.ts#PaymentRecordService.recordDeposit~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'entity:src%2Frental-contract%2Frental-contract.entity.ts#RentalContract',
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
        'service-method:src%2Fbooking-request%2Fbooking-request.service.ts#BookingRequestService.markRoomUnavailableForRequest~dd6f9df3949ebe095ea261fedb8d6afff333b1a449449ef86a9d6bba8b75dcbb',
        'service-method:src%2Froom%2Froom-availability.service.ts#RoomAvailabilityService.updateAvailability~56fa983d0e53409b683164f4e331009c27a55f598d6e307e4f04d0f2fcb2aa78',
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
        'api:src%2Frental-contract%2Frental-contract.controller.ts#RentalContractController.cancel~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Frental-contract%2Frental-contract.service.ts#RentalContractService.cancelContract~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fpayment%2Fpayment-record.service.ts#PaymentRecordService.markContractCancelled~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371',
        'service-method:src%2Fnotification%2Ftenant-notification.service.ts#TenantNotificationService.notifyTenantAndLandlord~0e541b15754744277076f1e5143b5556d2ad87f44ab4512bc6d44313d254a5d7',
        'entity:src%2Frental-contract%2Frental-contract.entity.ts#RentalContract',
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
