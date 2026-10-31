export type EvidenceCandidate = {
  artifactKey: string;
  symbolName: string;
  filePath: string;
  artifactType: string;
  excerpt: string;
  retrievalMethod: string;
  retrievalReason?: string;
};

export class EvidencePackFormatter {
  static format(candidates: EvidenceCandidate[]): string {
    const formatted = candidates
      .map((candidate, index) => {
        return `[EVIDENCE ${index + 1}]
artifactKey: ${encodePromptValue(candidate.artifactKey)}
symbol: ${encodePromptValue(candidate.symbolName)}
file: ${encodePromptValue(candidate.filePath)}
type: ${encodePromptValue(candidate.artifactType)}
retrievalMethod: ${encodePromptValue(candidate.retrievalMethod)}
retrievalReason: ${encodePromptValue(candidate.retrievalReason || 'Direct match')}
excerpt: ${encodePromptValue(candidate.excerpt)}`;
      })
      .join('\n\n');

    return `UNTRUSTED_REPOSITORY_CONTENT_START\n${formatted}\nUNTRUSTED_REPOSITORY_CONTENT_END`;
  }
}

function encodePromptValue(value: string): string {
  return JSON.stringify(value);
}
