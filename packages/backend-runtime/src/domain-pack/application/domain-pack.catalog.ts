import type { DomainPack } from '@ba-helper/contracts';
import { BookingDomainPack } from '../packs/booking.v0.1.0';
import { EcommerceDomainPack } from '../packs/ecommerce.v0.1.0';
import { GeneralDomainPack } from '../packs/general.v0.0.0';
import { HealthcareDomainPack } from '../packs/healthcare.v0.1.0';
import { RentalDomainPack } from '../packs/rental.v0.1.0';

export type DomainPackCatalogEntry = {
  pack: DomainPack;
  aliases: string[];
  displayName: string;
  knownLimits: string[];
  requiresExplicitSelection: boolean;
};

export const BUILT_IN_DOMAIN_PACK_CATALOG: DomainPackCatalogEntry[] = [
  {
    pack: GeneralDomainPack,
    aliases: ['general', 'general@0.0.0'],
    displayName: 'General Fallback',
    knownLimits: [
      'Generic fallback only; it has no domain-specific concepts, templates, or glossary.',
    ],
    requiresExplicitSelection: false,
  },
  {
    pack: BookingDomainPack,
    aliases: ['booking', 'booking@0.1.0'],
    displayName: 'Booking, Payment, Refund',
    knownLimits: [
      'Stable only for the covered booking/payment/refund evaluation cases.',
    ],
    requiresExplicitSelection: false,
  },
  {
    pack: EcommerceDomainPack,
    aliases: ['ecommerce', 'ecommerce@0.1.0'],
    displayName: 'Ecommerce Order Fulfillment (PARTIAL)',
    knownLimits: [
      'Partial ecommerce administrative workflow coverage only.',
      'No payment compliance validation.',
      'No fraud or risk scoring.',
      'No tax calculation validation.',
      'Source evidence is required for every claim.',
    ],
    requiresExplicitSelection: true,
  },
  {
    pack: RentalDomainPack,
    aliases: ['rental', 'rental@0.1.0'],
    displayName: 'Rental Workflows (PARTIAL)',
    knownLimits: [
      'Partial rental coverage only; source evidence is required for every claim.',
    ],
    requiresExplicitSelection: true,
  },
  {
    pack: HealthcareDomainPack,
    aliases: ['healthcare', 'healthcare@0.1.0'],
    displayName: 'Healthcare Admin Workflows (PARTIAL)',
    knownLimits: [
      'Domain hints are limited and require source evidence.',
      'This pack supports administrative workflow impact analysis only.',
      'It does not provide medical advice, clinical decision support, or compliance validation.',
    ],
    requiresExplicitSelection: true,
  },
];
