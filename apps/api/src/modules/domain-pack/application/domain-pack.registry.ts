import { Injectable } from '@nestjs/common';
import { DomainPack } from '@ba-helper/contracts';
import { GeneralDomainPack } from '../packs/general.v0.0.0';
import { BookingDomainPack } from '../packs/booking.v0.1.0';

@Injectable()
export class DomainPackRegistry {
  private readonly builtInPacks = new Map<string, DomainPack>();

  constructor() {
    this.register(GeneralDomainPack);
    this.register(BookingDomainPack);
  }

  /**
   * Registers a domain pack into the registry.
   */
  private register(pack: DomainPack): void {
    this.builtInPacks.set(pack.id, pack);
  }

  /**
   * Returns a domain pack by its ID.
   * If the pack is not found, returns the safe General fallback.
   */
  getPackById(id?: string | null): DomainPack {
    if (!id) {
      return GeneralDomainPack;
    }
    
    // Convert to lowercase to ensure matching works even if repository.domain is capitalized
    const normalizedId = id.toLowerCase();
    
    return this.builtInPacks.get(normalizedId) ?? GeneralDomainPack;
  }

  /**
   * Selects the appropriate domain pack for a given repository.
   * Currently maps the repository's declared domain to a pack ID.
   */
  selectForRepository(repositoryDomain?: string | null): DomainPack {
    if (!repositoryDomain || repositoryDomain === 'UNKNOWN') {
      return GeneralDomainPack;
    }

    return this.getPackById(repositoryDomain);
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

    // Convert Set to array. 
    // It's deterministic because Set iterates in insertion order,
    // and we iterate over pack.concepts in their defined order.
    return Array.from(matchedKeys);
  }
}
