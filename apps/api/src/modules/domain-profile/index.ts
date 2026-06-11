import { DomainProfile, BookingDomainProfile } from './profiles/booking.domain-profile';
import { PaymentDomainProfile } from './profiles/payment.domain-profile';
import { RefundDomainProfile } from './profiles/refund.domain-profile';
import { NotificationDomainProfile } from './profiles/notification.domain-profile';
import { UnknownDomainProfile } from './profiles/unknown.domain-profile';

export { DomainProfile };

export const SUPPORTED_DOMAINS = ['BOOKING', 'PAYMENT', 'REFUND', 'NOTIFICATION'] as const;
export const KNOWN_DOMAINS = [...SUPPORTED_DOMAINS, 'UNKNOWN'] as const;
export type SupportedDomain = typeof SUPPORTED_DOMAINS[number];
export type KnownDomain = typeof KNOWN_DOMAINS[number];

const DOMAIN_PROFILES: Record<string, DomainProfile> = {
  BOOKING: BookingDomainProfile,
  PAYMENT: PaymentDomainProfile,
  REFUND: RefundDomainProfile,
  NOTIFICATION: NotificationDomainProfile,
  UNKNOWN: UnknownDomainProfile,
};

/**
 * Returns the DomainProfile for the given domain key.
 *
 * Rules:
 * - `undefined` / missing / empty domain → defaults to BOOKING (MVP default)
 * - explicit unrecognized domain key → falls back to UNKNOWN (no throw)
 *
 * See: docs/adr/0006-domain-profile-strategy.md
 */
export function getDomainProfile(domain?: string): DomainProfile {
  if (domain === undefined || domain === null || domain === '') {
    return BookingDomainProfile;
  }
  return DOMAIN_PROFILES[domain] ?? UnknownDomainProfile;
}

/**
 * Returns true if the domain has an explicit known profile.
 * Used by diagnostics to indicate whether a fallback was applied.
 */
export function isDomainSupported(domain?: string): boolean {
  if (!domain) return false;
  return domain in DOMAIN_PROFILES && domain !== 'UNKNOWN';
}

/**
 * Returns glossary terms for the given domain — used for lexical search keyword expansion.
 * Not for prompt injection.
 */
export function getDomainGlossary(domain?: string): string[] {
  return getDomainProfile(domain).glossary;
}

/**
 * Returns which glossary terms from the domain profile appear in the given text.
 * Used for diagnostics — bounded, deterministic, never dumps full registry.
 */
export function matchDomainTerms(text: string, domain?: string): string[] {
  const glossary = getDomainGlossary(domain);
  const lowerText = text.toLowerCase();
  return glossary.filter((term) => lowerText.includes(term.toLowerCase()));
}
