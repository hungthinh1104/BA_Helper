import type { DomainPack } from '@ba-helper/contracts';

export const buildDomainPackTerms = (pack: DomainPack): string[] => {
  const terms = new Set<string>();

  for (const concept of pack.concepts) {
    terms.add(concept.label);
    for (const alias of concept.aliases) terms.add(alias);
    for (const keyword of concept.relatedArtifactKeywords) terms.add(keyword);
  }

  return Array.from(terms).filter(Boolean);
};

export const matchDomainPackTerms = (text: string, pack: DomainPack): string[] => {
  const lowerText = text.toLowerCase();
  return buildDomainPackTerms(pack).filter((term) =>
    lowerText.includes(term.toLowerCase()),
  );
};
