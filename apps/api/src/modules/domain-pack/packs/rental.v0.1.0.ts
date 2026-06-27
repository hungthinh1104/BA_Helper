import type { DomainPack } from '@ba-helper/contracts';

export const RentalDomainPack: DomainPack = {
  id: 'rental',
  name: 'Rental',
  version: '0.1.0',
  status: 'PARTIAL',
  description: 'Partial domain pack for rental contracts, deposits, room availability, and tenant/landlord workflows.',
  glossaryMetadata: [
    {
      locale: 'en',
      status: 'foundation',
      version: '1.0.0',
      termCount: 9,
    },
    {
      locale: 'vi',
      status: 'foundation',
      version: '1.0.0',
      termCount: 9,
    },
  ],

  concepts: [
    {
      key: 'rental_contract',
      label: 'Rental Contract',
      aliases: ['rental contract', 'lease contract', 'contract', 'rental agreement', 'lease'],
      relatedArtifactKeywords: ['contract', 'lease', 'agreement', 'rental'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'deposit',
      label: 'Deposit',
      aliases: ['deposit', 'security deposit', 'deposit payment'],
      relatedArtifactKeywords: ['deposit', 'security', 'payment'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'room_availability',
      label: 'Room Availability',
      aliases: ['room availability', 'availability', 'available room', 'vacancy', 'room status'],
      relatedArtifactKeywords: ['room', 'availability', 'vacancy', 'status'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'booking_request',
      label: 'Booking Request',
      aliases: ['booking request', 'rental request', 'room request', 'application request'],
      relatedArtifactKeywords: ['request', 'booking', 'application'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
    {
      key: 'tenant',
      label: 'Tenant',
      aliases: ['tenant', 'renter', 'occupant'],
      relatedArtifactKeywords: ['tenant', 'renter', 'occupant'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'landlord',
      label: 'Landlord',
      aliases: ['landlord', 'owner', 'property owner'],
      relatedArtifactKeywords: ['landlord', 'owner', 'property'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'payment_record',
      label: 'Payment Record',
      aliases: ['payment record', 'payment', 'rent payment', 'payment history', 'receipt'],
      relatedArtifactKeywords: ['payment', 'record', 'receipt', 'ledger'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'contract_transition',
      label: 'Contract Transition',
      aliases: ['contract transition', 'contract status', 'activate contract', 'cancel contract'],
      relatedArtifactKeywords: ['transition', 'status', 'activate', 'cancel'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'maintenance_request',
      label: 'Maintenance Request',
      aliases: ['maintenance request', 'repair request', 'maintenance', 'repair ticket'],
      relatedArtifactKeywords: ['maintenance', 'repair', 'ticket'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
  ],

  retrievalHints: [
    'rental contract status transition',
    'deposit payment record consistency',
    'room availability update',
    'booking request lifecycle',
    'tenant landlord notification',
  ],

  riskTemplates: [
    'PARTIAL rental hint: deposit payment and contract state may become inconsistent without source-backed transition evidence.',
    'PARTIAL rental hint: room availability may be updated before booking request state is settled.',
    'PARTIAL rental hint: tenant and landlord notification rules may differ by contract state.',
    'PARTIAL rental hint: maintenance request workflows are not covered beyond terminology matching.',
  ],

  qaTemplates: [
    'PARTIAL rental hint: verify deposit update changes only source-backed contract and payment-record behavior.',
    'PARTIAL rental hint: verify room availability updates through the booking request flow.',
    'PARTIAL rental hint: verify contract cancellation effects on payment records and tenant/landlord notification.',
  ],

  unknownTemplates: [
    'Which rental contract states allow deposit payment updates?',
    'When does room availability become visible after a booking request changes?',
    'Who must be notified when a rental contract is cancelled?',
    'Are maintenance requests in scope for this rental profile revision?',
  ],
};
