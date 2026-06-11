/**
 * Maps existing legacy DomainProfile values to canonical DomainPack IDs.
 * Hides BOOKING/UNKNOWN casing logic from the rest of the codebase.
 */
export class DomainProfileToDomainPackSelector {
  /**
   * Converts a legacy repository profile domain (e.g. "BOOKING", "UNKNOWN")
   * to a canonical DomainPack ID.
   */
  static mapProfileToPackId(profileValue?: string | null): string {
    if (!profileValue) {
      return 'general';
    }

    const lower = profileValue.toLowerCase().trim();

    if (lower === 'booking') {
      return 'booking';
    }

    // Explicitly handle UNKNOWN and other unrecognized values by mapping to general
    return 'general';
  }
}
