import { DomainProfile, BookingDomainProfile } from './profiles/booking.domain-profile';
import { AppError } from '../../shared/app-error';

export { DomainProfile };

export const SUPPORTED_DOMAINS = ['BOOKING'] as const;
export type SupportedDomain = typeof SUPPORTED_DOMAINS[number];

const DOMAIN_PROFILES: Record<string, DomainProfile> = {
  BOOKING: BookingDomainProfile,
};

/**
 * Returns the DomainProfile for the given domain key.
 *
 * Rules:
 * - `undefined` / missing domain → defaults to BOOKING (MVP default)
 * - explicit unsupported domain key → throws UnsupportedDomainError
 *
 * See: docs/adr/0006-domain-profile-strategy.md
 */
export function getDomainProfile(domain?: string): DomainProfile {
  if (domain === undefined || domain === null || domain === '') {
    return BookingDomainProfile;
  }
  const profile = DOMAIN_PROFILES[domain];
  if (!profile) {
    throw new AppError(
      'UNSUPPORTED_DOMAIN',
      `Domain "${domain}" is not supported. Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`,
    );
  }
  return profile;
}

/**
 * Returns glossary terms for the given domain — used for lexical search keyword expansion.
 * Not for prompt injection.
 */
export function getDomainGlossary(domain?: string): string[] {
  return getDomainProfile(domain).glossary;
}
