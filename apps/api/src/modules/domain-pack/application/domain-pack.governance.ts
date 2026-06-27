import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainPackSchema } from '@ba-helper/contracts';
import type {
  DomainGlossaryMetadata,
  DomainPack,
  DomainProfileCapabilityStatus,
} from '@ba-helper/contracts';
import type { DomainPackCatalogEntry } from './domain-pack.catalog';

export type DomainPackGovernanceError = {
  code: string;
  message: string;
  packId?: string;
  alias?: string;
};

export type DomainPackGovernanceResult = {
  ok: boolean;
  errors: DomainPackGovernanceError[];
  digests: Array<{
    canonicalId: string;
    digest: string;
  }>;
};

export type DomainPackGovernanceOptions = {
  glossaryRoot?: string;
};

const PACK_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HEALTHCARE_SAFETY_TERMS = [
  'medical advice',
  'clinical decision support',
  'compliance validation',
];

export function validateDomainPackCatalog(
  entries: DomainPackCatalogEntry[],
  options: DomainPackGovernanceOptions = {},
): DomainPackGovernanceResult {
  const errors: DomainPackGovernanceError[] = [];
  const seenPackIds = new Map<string, string>();
  const seenCanonicalIds = new Set<string>();
  const seenAliases = new Map<string, string>();

  for (const entry of entries) {
    validateEntryShape(entry, errors);
    validatePackIdentity(entry.pack, errors);
    validateConceptKeys(entry.pack, errors);
    validateKnownLimits(entry, errors);
    validateExplicitSelection(entry, errors);
    validateHealthcareSafety(entry, errors);
    validateGlossaryMetadata(entry.pack, options, errors);

    const existingPackVersion = seenPackIds.get(entry.pack.id);
    if (existingPackVersion) {
      errors.push({
        code: 'DUPLICATE_DOMAIN_PACK_ID',
        message: `Duplicate domain pack id "${entry.pack.id}" for versions ${existingPackVersion} and ${entry.pack.version}.`,
        packId: entry.pack.id,
      });
    } else {
      seenPackIds.set(entry.pack.id, entry.pack.version);
    }

    const canonicalId = `${entry.pack.id}@${entry.pack.version}`;
    if (seenCanonicalIds.has(canonicalId)) {
      errors.push({
        code: 'DUPLICATE_DOMAIN_PACK_VERSION',
        message: `Duplicate domain pack canonical id "${canonicalId}".`,
        packId: entry.pack.id,
      });
    }
    seenCanonicalIds.add(canonicalId);

    const localAliases = new Set<string>();
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeAlias(alias);
      if (localAliases.has(normalizedAlias)) {
        errors.push({
          code: 'DUPLICATE_DOMAIN_PACK_ALIAS',
          message: `Alias "${alias}" is duplicated inside ${canonicalId}.`,
          packId: entry.pack.id,
          alias,
        });
      }
      localAliases.add(normalizedAlias);

      const previousPack = seenAliases.get(normalizedAlias);
      if (previousPack && previousPack !== canonicalId) {
        errors.push({
          code: 'DUPLICATE_DOMAIN_PACK_ALIAS',
          message: `Alias "${alias}" is used by both ${previousPack} and ${canonicalId}.`,
          packId: entry.pack.id,
          alias,
        });
      } else {
        seenAliases.set(normalizedAlias, canonicalId);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    digests: entries.map((entry) => ({
      canonicalId: `${entry.pack.id}@${entry.pack.version}`,
      digest: computeDomainPackManifestDigest(entry),
    })),
  };
}

export function computeDomainPackManifestDigest(entry: DomainPackCatalogEntry): string {
  const canonical = {
    pack: entry.pack,
    registry: {
      aliases: entry.aliases,
      displayName: entry.displayName,
      knownLimits: entry.knownLimits,
      requiresExplicitSelection: entry.requiresExplicitSelection,
    },
  };

  return `sha256:${createHash('sha256')
    .update(stableStringify(canonical))
    .digest('hex')}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function validateEntryShape(
  entry: DomainPackCatalogEntry,
  errors: DomainPackGovernanceError[],
) {
  const parsed = domainPackSchema.safeParse(entry.pack);
  if (!parsed.success) {
    errors.push({
      code: 'INVALID_DOMAIN_PACK_SCHEMA',
      message: parsed.error.message,
      packId: entry.pack?.id,
    });
  }

  if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
    errors.push({
      code: 'DOMAIN_PACK_ALIASES_REQUIRED',
      message: 'Domain pack aliases must be a non-empty array.',
      packId: entry.pack?.id,
    });
  }

  if (typeof entry.requiresExplicitSelection !== 'boolean') {
    errors.push({
      code: 'DOMAIN_PACK_EXPLICIT_SELECTION_REQUIRED',
      message: 'Domain pack registry entry must declare requiresExplicitSelection.',
      packId: entry.pack?.id,
    });
  }
}

function validatePackIdentity(
  pack: DomainPack,
  errors: DomainPackGovernanceError[],
) {
  if (!PACK_ID_PATTERN.test(pack.id)) {
    errors.push({
      code: 'INVALID_DOMAIN_PACK_ID',
      message: `Domain pack id "${pack.id}" must be lowercase kebab-case.`,
      packId: pack.id,
    });
  }

  if (!SEMVER_PATTERN.test(pack.version)) {
    errors.push({
      code: 'INVALID_DOMAIN_PACK_VERSION',
      message: `Domain pack version "${pack.version}" must be semver MAJOR.MINOR.PATCH.`,
      packId: pack.id,
    });
  }

  if (!isKnownStatus(pack.status)) {
    errors.push({
      code: 'INVALID_DOMAIN_PACK_STATUS',
      message: `Domain pack status "${pack.status}" is unsupported.`,
      packId: pack.id,
    });
  }
}

function validateConceptKeys(
  pack: DomainPack,
  errors: DomainPackGovernanceError[],
) {
  const seenConcepts = new Set<string>();
  for (const concept of pack.concepts) {
    if (seenConcepts.has(concept.key)) {
      errors.push({
        code: 'DUPLICATE_DOMAIN_CONCEPT_KEY',
        message: `Duplicate concept key "${concept.key}" in ${pack.id}@${pack.version}.`,
        packId: pack.id,
      });
    }
    seenConcepts.add(concept.key);
  }
}

function validateKnownLimits(
  entry: DomainPackCatalogEntry,
  errors: DomainPackGovernanceError[],
) {
  if (entry.pack.status === 'PARTIAL' && entry.knownLimits.length === 0) {
    errors.push({
      code: 'PARTIAL_DOMAIN_PACK_REQUIRES_KNOWN_LIMITS',
      message: `PARTIAL domain pack ${entry.pack.id}@${entry.pack.version} must declare known limits.`,
      packId: entry.pack.id,
    });
  }
}

function validateExplicitSelection(
  entry: DomainPackCatalogEntry,
  errors: DomainPackGovernanceError[],
) {
  if (
    entry.pack.status === 'PARTIAL' &&
    entry.requiresExplicitSelection !== true
  ) {
    errors.push({
      code: 'PARTIAL_DOMAIN_PACK_REQUIRES_EXPLICIT_SELECTION',
      message: `PARTIAL domain pack ${entry.pack.id}@${entry.pack.version} must require explicit selection.`,
      packId: entry.pack.id,
    });
  }
}

function validateHealthcareSafety(
  entry: DomainPackCatalogEntry,
  errors: DomainPackGovernanceError[],
) {
  if (!isHealthcareLike(entry)) {
    return;
  }

  const safetyText = entry.knownLimits.join(' ').toLowerCase();
  const missingTerms = HEALTHCARE_SAFETY_TERMS.filter(
    (term) => !safetyText.includes(term),
  );
  if (missingTerms.length > 0) {
    errors.push({
      code: 'HEALTHCARE_ADMIN_PACK_REQUIRES_SAFETY_LIMITS',
      message: `Healthcare/admin domain pack ${entry.pack.id}@${entry.pack.version} is missing safety limits: ${missingTerms.join(', ')}.`,
      packId: entry.pack.id,
    });
  }
}

function validateGlossaryMetadata(
  pack: DomainPack,
  options: DomainPackGovernanceOptions,
  errors: DomainPackGovernanceError[],
) {
  if (!options.glossaryRoot) {
    return;
  }

  for (const metadata of pack.glossaryMetadata) {
    const glossary = readGlossary(options.glossaryRoot, pack.id, metadata);
    if (!glossary) {
      errors.push({
        code: 'DOMAIN_GLOSSARY_NOT_FOUND',
        message: `Glossary file for ${pack.id}/${metadata.locale} was not found.`,
        packId: pack.id,
      });
      continue;
    }

    if (glossary.termCount !== metadata.termCount) {
      errors.push({
        code: 'DOMAIN_GLOSSARY_TERM_COUNT_MISMATCH',
        message: `Glossary ${pack.id}/${metadata.locale} declares ${metadata.termCount} terms but file contains ${glossary.termCount}.`,
        packId: pack.id,
      });
    }

    if (
      glossary.domain !== pack.id ||
      glossary.locale !== metadata.locale ||
      glossary.status !== metadata.status ||
      glossary.version !== metadata.version
    ) {
      errors.push({
        code: 'DOMAIN_GLOSSARY_METADATA_MISMATCH',
        message: `Glossary metadata for ${pack.id}/${metadata.locale} does not match pack metadata.`,
        packId: pack.id,
      });
    }
  }
}

function readGlossary(
  glossaryRoot: string,
  domain: string,
  metadata: DomainGlossaryMetadata,
) {
  const file = join(glossaryRoot, domain, `${metadata.locale}.glossary.json`);
  if (!existsSync(file)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(file, 'utf-8')) as {
    domain?: unknown;
    locale?: unknown;
    status?: unknown;
    version?: unknown;
    terms?: unknown;
  };

  return {
    domain: parsed.domain,
    locale: parsed.locale,
    status: parsed.status,
    version: parsed.version,
    termCount:
      parsed.terms && typeof parsed.terms === 'object' && !Array.isArray(parsed.terms)
        ? Object.keys(parsed.terms).length
        : -1,
  };
}

function normalizeAlias(alias: string) {
  return alias.trim().toLowerCase();
}

function isKnownStatus(value: string): value is DomainProfileCapabilityStatus {
  return (
    value === 'STABLE' ||
    value === 'PARTIAL' ||
    value === 'EXPERIMENTAL' ||
    value === 'FALLBACK'
  );
}

function isHealthcareLike(entry: DomainPackCatalogEntry) {
  const text = [
    entry.pack.id,
    entry.pack.name,
    entry.pack.description,
    entry.displayName,
    ...entry.pack.concepts.map((concept) => concept.label),
    ...entry.pack.riskTemplates,
    ...entry.pack.unknownTemplates,
  ]
    .join(' ')
    .toLowerCase();

  return /healthcare|medical|clinical|patient|provider/.test(text);
}
