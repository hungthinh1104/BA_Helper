import { Injectable } from '@nestjs/common';
import {
  DomainPack,
  DomainPackSelectedBy,
  DomainProfileRegistryEntry,
  ResolvedDomainPackSelection,
} from '@ba-helper/contracts';
import { GeneralDomainPack } from '../packs/general.v0.0.0';
import { BookingDomainPack } from '../packs/booking.v0.1.0';
import { RentalDomainPack } from '../packs/rental.v0.1.0';
import { HealthcareDomainPack } from '../packs/healthcare.v0.1.0';
import { AppError } from '@ba-helper/shared';

export type DomainPackSelectionInput = {
  manualPackId?: string | null;
  repositoryProfileDomain?: string | null;
};

export type DomainPackSelectionResult = {
  pack: DomainPack;
  normalizedPackId: string;
  selectedBy: DomainPackSelectedBy;
  resolved: ResolvedDomainPackSelection;
};

type DomainPackCatalogEntry = {
  pack: DomainPack;
  aliases: string[];
  displayName: string;
  knownLimits: string[];
  requiresExplicitSelection: boolean;
};

@Injectable()
export class DomainPackRegistry {
  private readonly builtInPacks = new Map<string, DomainPack>();
  private readonly catalog = new Map<string, DomainPackCatalogEntry>();
  private readonly aliasToPackId = new Map<string, string>();

  constructor() {
    this.register(GeneralDomainPack, {
      aliases: ['general', 'general@0.0.0'],
      displayName: 'General Fallback',
      knownLimits: [
        'Generic fallback only; it has no domain-specific concepts, templates, or glossary.',
      ],
      requiresExplicitSelection: false,
    });
    this.register(BookingDomainPack, {
      aliases: ['booking', 'booking@0.1.0'],
      displayName: 'Booking, Payment, Refund',
      knownLimits: [
        'Stable only for the covered booking/payment/refund evaluation cases.',
      ],
      requiresExplicitSelection: false,
    });
    this.register(RentalDomainPack, {
      aliases: ['rental', 'rental@0.1.0'],
      displayName: 'Rental Workflows (PARTIAL)',
      knownLimits: [
        'Partial rental coverage only; source evidence is required for every claim.',
      ],
      requiresExplicitSelection: true,
    });
    this.register(HealthcareDomainPack, {
      aliases: ['healthcare', 'healthcare@0.1.0'],
      displayName: 'Healthcare Admin Workflows (PARTIAL)',
      knownLimits: [
        'Domain hints are limited and require source evidence.',
        'This pack supports administrative workflow impact analysis only.',
        'It does not provide medical advice, clinical decision support, or compliance validation.',
      ],
      requiresExplicitSelection: true,
    });
  }

  /**
   * Registers a domain pack into the registry.
   */
  private register(
    pack: DomainPack,
    metadata: Omit<DomainPackCatalogEntry, 'pack'>,
  ): void {
    this.builtInPacks.set(pack.id, pack);
    this.catalog.set(pack.id, { pack, ...metadata });

    for (const alias of metadata.aliases) {
      this.aliasToPackId.set(alias.toLowerCase().trim(), pack.id);
    }
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

    const normalizedId = this.normalizePackId(id);

    return this.builtInPacks.get(normalizedId) ?? GeneralDomainPack;
  }

  private toProfileEntry(pack: DomainPack): DomainProfileRegistryEntry {
    const catalogEntry = this.catalog.get(pack.id);
    return {
      id: pack.id,
      version: pack.version,
      canonicalId: `${pack.id}@${pack.version}`,
      displayName: catalogEntry?.displayName ?? pack.name,
      status: pack.status,
      description: pack.description,
      supportedConcepts: pack.concepts.map((concept) => ({
        key: concept.key,
        label: concept.label,
      })),
      knownLimits: catalogEntry?.knownLimits ?? [],
      requiresExplicitSelection: catalogEntry?.requiresExplicitSelection ?? true,
      aliases: catalogEntry?.aliases ?? [`${pack.id}@${pack.version}`],
      glossaryMetadata: pack.glossaryMetadata,
    };
  }

  /**
   * Normalizes a pack ID by stripping version numbers and standardizing casing.
   * e.g., "BOOKING" -> "booking", "booking@0.1.0" -> "booking"
   */
  normalizePackId(packId: string): string {
    const lower = packId.toLowerCase().trim();
    return this.aliasToPackId.get(lower) ?? lower.split('@')[0];
  }

  listSupportedCanonicalIds(): string[] {
    return Array.from(this.builtInPacks.values())
      .map((pack) => `${pack.id}@${pack.version}`)
      .sort();
  }

  /**
   * Selects the appropriate domain pack based on deterministic priority.
   * 1. manualPackId
   * 2. repositoryProfileDomain
   * 3. fallback (general)
   */
  selectPack(input: DomainPackSelectionInput): DomainPackSelectionResult {
    if (input.manualPackId) {
      const requested = input.manualPackId.trim();
      const normalized = this.normalizePackId(requested);
      const foundPack = this.builtInPacks.get(normalized);

      if (!foundPack) {
        throw new AppError(
          'UNSUPPORTED_DOMAIN_PACK',
          `Unsupported manual domain pack: ${input.manualPackId}`,
          {
            requested: input.manualPackId,
            supported: this.listSupportedCanonicalIds(),
          },
        );
      }

      if (requested.includes('@')) {
        const providedVersion = requested.split('@')[1];
        if (providedVersion !== foundPack.version) {
          throw new AppError(
            'UNSUPPORTED_DOMAIN_PACK_VERSION',
            `Unsupported domain pack version for ${normalized}: ${providedVersion}`,
            {
              requested: input.manualPackId,
              supported: this.listSupportedCanonicalIds(),
            },
          );
        }
      }

      return {
        pack: foundPack,
        normalizedPackId: normalized,
        selectedBy: 'EXPLICIT',
        resolved: this.buildResolved({
          requestedDomainPackId: input.manualPackId,
          pack: foundPack,
          selectedBy: 'EXPLICIT',
        }),
      };
    }

    if (input.repositoryProfileDomain) {
      const normalized = this.normalizePackId(input.repositoryProfileDomain);

      if (normalized === 'unknown') {
        return {
          pack: GeneralDomainPack,
          normalizedPackId: 'general',
          selectedBy: 'FALLBACK',
          resolved: this.buildResolved({
            requestedDomainPackId: null,
            pack: GeneralDomainPack,
            selectedBy: 'FALLBACK',
          }),
        };
      }

      const foundPack = this.builtInPacks.get(normalized);
      const catalogEntry = foundPack ? this.catalog.get(foundPack.id) : null;
      if (foundPack && !catalogEntry?.requiresExplicitSelection) {
        return {
          pack: foundPack,
          normalizedPackId: normalized,
          selectedBy: 'REPOSITORY_PROFILE',
          resolved: this.buildResolved({
            requestedDomainPackId: null,
            pack: foundPack,
            selectedBy: 'REPOSITORY_PROFILE',
          }),
        };
      }
    }

    return {
      pack: GeneralDomainPack,
      normalizedPackId: 'general',
      selectedBy: 'FALLBACK',
      resolved: this.buildResolved({
        requestedDomainPackId: null,
        pack: GeneralDomainPack,
        selectedBy: 'FALLBACK',
      }),
    };
  }

  selectResolvedPack(selection: ResolvedDomainPackSelection): DomainPackSelectionResult {
    const normalized = this.normalizePackId(
      `${selection.resolvedDomainPackId}@${selection.resolvedDomainPackVersion}`,
    );
    const pack = this.builtInPacks.get(normalized);

    if (!pack || pack.version !== selection.resolvedDomainPackVersion) {
      throw new AppError(
        'UNSUPPORTED_DOMAIN_PACK_VERSION',
        `Unsupported persisted domain pack version for ${selection.resolvedDomainPackId}: ${selection.resolvedDomainPackVersion}`,
        {
          requested: `${selection.resolvedDomainPackId}@${selection.resolvedDomainPackVersion}`,
          supported: this.listSupportedCanonicalIds(),
        },
      );
    }

    return {
      pack,
      normalizedPackId: normalized,
      selectedBy: selection.selectedBy,
      resolved: selection,
    };
  }

  private buildResolved(params: {
    requestedDomainPackId: string | null;
    pack: DomainPack;
    selectedBy: DomainPackSelectedBy;
  }): ResolvedDomainPackSelection {
    return {
      requestedDomainPackId: params.requestedDomainPackId,
      resolvedDomainPackId: params.pack.id,
      resolvedDomainPackVersion: params.pack.version,
      resolvedDomainPackStatus: params.pack.status,
      selectedBy: params.selectedBy,
      resolvedAt: new Date().toISOString(),
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
