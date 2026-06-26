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
  const normalizedDomain = domain.toUpperCase();
  return DOMAIN_PROFILES[normalizedDomain] ?? UnknownDomainProfile;
}

/**
 * Returns true if the domain has an explicit known profile.
 * Used by diagnostics to indicate whether a fallback was applied.
 */
export function isDomainSupported(domain?: string): boolean {
  if (!domain) return false;
  const normalizedDomain = domain.toUpperCase();
  return normalizedDomain in DOMAIN_PROFILES && normalizedDomain !== 'UNKNOWN';
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

/**
 * Builds a compact, bounded domain context string for LLM prompt injection.
 *
 * Rules:
 * - At most 5 glossary terms, 4 risk categories, 3 QA focus areas.
 * - UNKNOWN domain produces a generic advisory, not domain-specific hints.
 * - Never dumps the full profile into the prompt.
 */
export function buildCompactDomainContext(domain?: string): string {
  const profile = getDomainProfile(domain);
  const glossaryHints = profile.glossary.slice(0, 5).join(', ');
  const riskHints = profile.riskCategories.slice(0, 4).map((r) => `- ${r}`).join('\n');
  const qaHints = profile.qaScenarioTemplates.slice(0, 3).map((q) => `- ${q}`).join('\n');

  return [
    `Domain: ${profile.domain}`,
    `Key terms: ${glossaryHints}`,
    `Risk focus:\n${riskHints}`,
    `QA focus:\n${qaHints}`,
  ].join('\n');
}
