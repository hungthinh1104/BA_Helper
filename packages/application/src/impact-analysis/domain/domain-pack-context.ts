import type { DomainPack } from '@ba-helper/contracts';

const take = <T>(items: T[], limit: number) => items.slice(0, limit);

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

export const buildDomainPackPromptContext = (pack: DomainPack): string => {
  if (pack.status === 'FALLBACK' || pack.concepts.length === 0) {
    return [
      `Domain pack: ${pack.id}@${pack.version}`,
      `Capability status: ${pack.status}`,
      'Terminology hints: none',
      'Risk focus: use only source-backed evidence and mark weak domain-specific assumptions as UNKNOWN.',
      'QA focus: derive scenarios only from retrieved source evidence and explicit unknowns.',
    ].join('\n');
  }

  const terms = unique(
    pack.concepts.flatMap((concept) => [
      concept.label,
      ...concept.aliases,
      ...concept.relatedArtifactKeywords,
    ]),
  );

  return [
    `Domain pack: ${pack.id}@${pack.version}`,
    `Capability status: ${pack.status}`,
    `Terminology hints: ${take(terms, 8).join(', ')}`,
    `Risk focus:\n${take(pack.riskTemplates, 4).map((risk) => `- ${risk}`).join('\n')}`,
    `QA focus:\n${take(pack.qaTemplates, 3).map((scenario) => `- ${scenario}`).join('\n')}`,
    `Unknown prompts:\n${take(pack.unknownTemplates, 3).map((unknown) => `- ${unknown}`).join('\n')}`,
    'Domain pack hints are terminology guidance only; they are not evidence.',
  ].join('\n');
};
