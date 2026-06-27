import { resolve } from 'node:path';
import type { DomainPackCatalogEntry } from './domain-pack.catalog';
import { BUILT_IN_DOMAIN_PACK_CATALOG } from './domain-pack.catalog';
import {
  computeDomainPackManifestDigest,
  validateDomainPackCatalog,
} from './domain-pack.governance';

describe('domain pack governance validation', () => {
  const glossaryRoot = resolve(process.cwd(), 'packages/domain-packs');

  it('passes all built-in domain packs', () => {
    const result = validateDomainPackCatalog(BUILT_IN_DOMAIN_PACK_CATALOG, {
      glossaryRoot,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.digests).toHaveLength(BUILT_IN_DOMAIN_PACK_CATALOG.length);
    expect(result.digests.every((item) => item.digest.startsWith('sha256:'))).toBe(true);
  });

  it('keeps short aliases mapped to exactly one canonical pack', () => {
    const shortAliases = new Map<string, string>();
    for (const entry of BUILT_IN_DOMAIN_PACK_CATALOG) {
      const canonicalId = `${entry.pack.id}@${entry.pack.version}`;
      for (const alias of entry.aliases) {
        if (alias.includes('@')) {
          continue;
        }
        const existing = shortAliases.get(alias);
        expect(existing ?? canonicalId).toBe(canonicalId);
        shortAliases.set(alias, canonicalId);
      }
    }

    expect(shortAliases.get('healthcare')).toBe('healthcare@0.1.0');
  });

  it('fails duplicate canonical pack ids', () => {
    const duplicate = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[0]);

    const result = validateDomainPackCatalog([
      BUILT_IN_DOMAIN_PACK_CATALOG[0],
      duplicate,
    ]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_DOMAIN_PACK_VERSION' }),
      ]),
    );
  });

  it('enforces one active version per domain id for now', () => {
    const nextHealthcare = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[3]);
    nextHealthcare.pack.version = '0.2.0';
    nextHealthcare.aliases = ['healthcare-next', 'healthcare@0.2.0'];

    const result = validateDomainPackCatalog([
      BUILT_IN_DOMAIN_PACK_CATALOG[3],
      nextHealthcare,
    ]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MULTIPLE_ACTIVE_DOMAIN_PACK_VERSIONS_UNSUPPORTED',
        }),
      ]),
    );
  });

  it('fails duplicate short aliases across active packs', () => {
    const duplicateAlias = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[1]);
    duplicateAlias.aliases = ['general'];

    const result = validateDomainPackCatalog([
      BUILT_IN_DOMAIN_PACK_CATALOG[0],
      duplicateAlias,
    ]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_DOMAIN_PACK_ALIAS' }),
      ]),
    );
  });

  it('fails duplicate aliases inside a pack', () => {
    const entry = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[1]);
    entry.aliases = ['booking', 'BOOKING'];

    const result = validateDomainPackCatalog([entry]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_DOMAIN_PACK_ALIAS' }),
      ]),
    );
  });

  it('fails duplicate concept keys inside a pack', () => {
    const entry = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[1]);
    entry.pack.concepts.push({ ...entry.pack.concepts[0] });

    const result = validateDomainPackCatalog([entry]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_DOMAIN_CONCEPT_KEY' }),
      ]),
    );
  });

  it('fails invalid semver versions', () => {
    const entry = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[1]);
    entry.pack.version = 'v1';

    const result = validateDomainPackCatalog([entry]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_DOMAIN_PACK_VERSION' }),
      ]),
    );
  });

  it('fails PARTIAL packs without known limits', () => {
    const entry = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[3]);
    entry.knownLimits = [];

    const result = validateDomainPackCatalog([entry]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PARTIAL_DOMAIN_PACK_REQUIRES_KNOWN_LIMITS',
        }),
      ]),
    );
  });

  it('fails explicit-only healthcare admin packs without safety disclaimers', () => {
    const entry = cloneEntry(BUILT_IN_DOMAIN_PACK_CATALOG[3]);
    entry.knownLimits = ['Administrative workflow hints only.'];

    const result = validateDomainPackCatalog([entry]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HEALTHCARE_ADMIN_PACK_REQUIRES_SAFETY_LIMITS',
        }),
      ]),
    );
  });

  it('keeps digest stable for equivalent canonical content with different object key order', () => {
    const entry = BUILT_IN_DOMAIN_PACK_CATALOG[3];
    const reordered: DomainPackCatalogEntry = {
      requiresExplicitSelection: entry.requiresExplicitSelection,
      knownLimits: entry.knownLimits,
      displayName: entry.displayName,
      aliases: entry.aliases,
      pack: {
        unknownTemplates: entry.pack.unknownTemplates,
        qaTemplates: entry.pack.qaTemplates,
        riskTemplates: entry.pack.riskTemplates,
        retrievalHints: entry.pack.retrievalHints,
        concepts: entry.pack.concepts,
        glossaryMetadata: entry.pack.glossaryMetadata,
        description: entry.pack.description,
        status: entry.pack.status,
        version: entry.pack.version,
        name: entry.pack.name,
        id: entry.pack.id,
      },
    };

    expect(computeDomainPackManifestDigest(reordered)).toBe(
      computeDomainPackManifestDigest(entry),
    );
  });

  it('changes digest when concepts, templates, or glossary metadata change', () => {
    const base = BUILT_IN_DOMAIN_PACK_CATALOG[3];
    const conceptChanged = cloneEntry(base);
    conceptChanged.pack.concepts[0] = {
      ...conceptChanged.pack.concepts[0],
      label: 'Appointment Scheduling Changed',
    };
    const templateChanged = cloneEntry(base);
    templateChanged.pack.riskTemplates.push('New safety-backed risk template.');
    const glossaryChanged = cloneEntry(base);
    glossaryChanged.pack.glossaryMetadata[0] = {
      ...glossaryChanged.pack.glossaryMetadata[0],
      termCount: glossaryChanged.pack.glossaryMetadata[0].termCount + 1,
    };

    const baseDigest = computeDomainPackManifestDigest(base);

    expect(computeDomainPackManifestDigest(conceptChanged)).not.toBe(baseDigest);
    expect(computeDomainPackManifestDigest(templateChanged)).not.toBe(baseDigest);
    expect(computeDomainPackManifestDigest(glossaryChanged)).not.toBe(baseDigest);
  });
});

function cloneEntry(entry: DomainPackCatalogEntry): DomainPackCatalogEntry {
  return JSON.parse(JSON.stringify(entry)) as DomainPackCatalogEntry;
}
