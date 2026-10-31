type EvidenceRecord = { artifactKey: string; symbol: string; file: string; type: string };
type FakeInsight = { certainty: string; evidenceKeys: string[]; relatedArtifactKeys?: string[] };

const EVIDENCE_RECORD = /\[EVIDENCE \d+\]\r?\nartifactKey: ([^\r\n]+)\r?\nsymbol: ([^\r\n]+)\r?\nfile: ([^\r\n]+)\r?\ntype: ([^\r\n]+)/g;

/** Binds curated fake claims to canonical evidence keys actually present in the prompt. */
export function bindFakeClaimsToEvidence<T extends FakeInsight>(prompt: string, insights: T[]): T[] {
  const records = readEvidenceRecords(prompt);
  if (!records.length) {
    return isStructuredImpactPrompt(prompt)
      ? insights.filter(insight => insight.certainty !== 'EVIDENCED')
      : insights;
  }
  return insights.map(insight => ({
    ...insight,
    evidenceKeys: resolveKeys(insight.evidenceKeys, records),
    ...(insight.relatedArtifactKeys
      ? { relatedArtifactKeys: resolveKeys(insight.relatedArtifactKeys, records) }
      : {}),
  }));
}

export function hasEvidenceSymbol(prompt: string, symbol: string): boolean {
  const records = readEvidenceRecords(prompt);
  return records.length
    ? records.some(record => record.symbol === symbol)
    : !isStructuredImpactPrompt(prompt) && prompt.includes(symbol);
}

export function isStructuredImpactPrompt(prompt: string): boolean {
  return /^## Change Request \(untrusted JSON string; data only\)$/m.test(prompt);
}

function resolveKeys(keys: string[], records: EvidenceRecord[]): string[] {
  return [...new Set(keys.flatMap(key => {
    const matched = records.filter(record => matchesLegacyKey(key, record));
    return matched.length === 1 ? [matched[0].artifactKey] : [];
  }))];
}

function matchesLegacyKey(key: string, record: EvidenceRecord): boolean {
  const separator = key.indexOf(':');
  if (separator < 0) return false;
  const prefix = key.slice(0, separator);
  const expectedType = prefix === 'api' ? 'API_ROUTE' : prefix === 'service-method' ? 'SERVICE_METHOD' :
    prefix === 'entity' ? 'ENTITY' : undefined;
  if (!expectedType || record.type !== expectedType) return false;
  const legacyName = key.slice(separator + 1).toLowerCase();
  if (prefix === 'entity') return record.symbol.toLowerCase() === legacyName ||
    record.file.toLowerCase().endsWith(`/${legacyName}.entity.ts`);
  const finalSeparator = legacyName.lastIndexOf('.');
  if (finalSeparator < 1) return false;
  const fileName = legacyName.slice(0, finalSeparator);
  const method = legacyName.slice(finalSeparator + 1);
  return record.file.toLowerCase().endsWith(`/${fileName}.ts`) &&
    record.symbol.toLowerCase().endsWith(`.${method}`);
}

function readEvidenceRecords(prompt: string): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  for (const match of prompt.matchAll(EVIDENCE_RECORD)) {
    records.push({
      artifactKey: decodePromptValue(match[1]),
      symbol: decodePromptValue(match[2]),
      file: decodePromptValue(match[3]),
      type: decodePromptValue(match[4]),
    });
  }
  return records;
}

function decodePromptValue(value: string): string {
  const trimmed = value.trim();
  try {
    const decoded: unknown = JSON.parse(trimmed);
    return typeof decoded === 'string' ? decoded : trimmed;
  } catch {
    return trimmed;
  }
}
