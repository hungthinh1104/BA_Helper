import { Injectable } from '@nestjs/common';
import { DomainPack, DomainProfileRegistryEntry } from '@ba-helper/contracts';
import { GeneralDomainPack } from '../packs/general.v0.0.0';
import { BookingDomainPack } from '../packs/booking.v0.1.0';
import { RentalDomainPack } from '../packs/rental.v0.1.0';
import { AppError } from '../../../shared/app-error';

export type DomainPackSelectionInput = {
  manualPackId?: string | null;
  repositoryProfileDomain?: string | null;
};

export type DomainPackSelectionResult = {
  pack: DomainPack;
  normalizedPackId: string;
  selectedBy: 'manual_config' | 'repository_profile' | 'safe_default';
};

@Injectable()
export class DomainPackRegistry {
  private readonly builtInPacks = new Map<string, DomainPack>();

  constructor() {
    this.register(GeneralDomainPack);
    this.register(BookingDomainPack);
    this.register(RentalDomainPack);
  }

  /**
   * Registers a domain pack into the registry.
   */
  private register(pack: DomainPack): void {
    this.builtInPacks.set(pack.id, pack);
  }

  listProfiles(): DomainProfileRegistryEntry[] {
    return Array.from(this.builtInPacks.values())
      .map((pack) => this.toProfileEntry(pack))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  getProfileById(id?: string | null): DomainProfileRegistryEntry {
    return this.toProfileEntry(this.getPackById(id));
  }

  /**
   * Returns a domain pack by its ID.
   * If the pack is not found, returns the safe General fallback.
   */
  getPackById(id?: string | null): DomainPack {
    if (!id) {
      return GeneralDomainPack;
    }

    const normalizedId = id.toLowerCase();

    return this.builtInPacks.get(normalizedId) ?? GeneralDomainPack;
  }

  private toProfileEntry(pack: DomainPack): DomainProfileRegistryEntry {
    return {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      status: pack.status,
      description: pack.description,
      glossaryMetadata: pack.glossaryMetadata,
    };
  }

  /**
   * Normalizes a pack ID by stripping version numbers and standardizing casing.
   * e.g., "BOOKING" -> "booking", "booking@0.1.0" -> "booking"
   */
  normalizePackId(packId: string): string {
    const lower = packId.toLowerCase().trim();
    const withoutVersion = lower.split('@')[0];
    return withoutVersion;
  }

  /**
   * Selects the appropriate domain pack based on deterministic priority.
   * 1. manualPackId
   * 2. repositoryProfileDomain
   * 3. safe_default (general)
   */
  selectPack(input: DomainPackSelectionInput): DomainPackSelectionResult {
    if (input.manualPackId) {
      const normalized = this.normalizePackId(input.manualPackId);
      const foundPack = this.builtInPacks.get(normalized);

      if (!foundPack) {
        throw new AppError('UNSUPPORTED_DOMAIN_PACK', `Unsupported manual domain pack: ${input.manualPackId}`);
      }

      if (input.manualPackId.includes('@')) {
        const providedVersion = input.manualPackId.split('@')[1];
        if (providedVersion !== foundPack.version) {
          throw new AppError('UNSUPPORTED_DOMAIN_PACK_VERSION', `Unsupported domain pack version for ${normalized}: ${providedVersion}`);
        }
      }

      return {
        pack: foundPack,
        normalizedPackId: normalized,
        selectedBy: 'manual_config',
      };
    }

    if (input.repositoryProfileDomain) {
      const normalized = this.normalizePackId(input.repositoryProfileDomain);

      if (normalized === 'unknown') {
        return {
          pack: GeneralDomainPack,
          normalizedPackId: 'general',
          selectedBy: 'safe_default',
        };
      }

      const foundPack = this.builtInPacks.get(normalized);
      if (foundPack) {
        return {
          pack: foundPack,
          normalizedPackId: normalized,
          selectedBy: 'repository_profile',
        };
      }
    }

    return {
      pack: GeneralDomainPack,
      normalizedPackId: 'general',
      selectedBy: 'safe_default',
    };
  }

  /**
   * @deprecated Use selectPack() instead.
   */
  selectForRepository(repositoryDomain?: string | null): DomainPack {
    return this.selectPack({ repositoryProfileDomain: repositoryDomain }).pack;
  }

  /**
   * Matches text against the concepts in a given domain pack.
   * Returns a deterministic, deduplicated list of matched concept keys.
   */
  matchConcepts(text: string, pack: DomainPack): string[] {
    const matchedKeys = new Set<string>();
    const lowerText = text.toLowerCase();

    // Iterate in definition order (which is deterministic based on the pack)
    for (const concept of pack.concepts) {
      for (const alias of concept.aliases) {
        if (lowerText.includes(alias.toLowerCase())) {
          matchedKeys.add(concept.key);
          break; // move to next concept once matched
        }
      }
    }

    return Array.from(matchedKeys);
  }
}
