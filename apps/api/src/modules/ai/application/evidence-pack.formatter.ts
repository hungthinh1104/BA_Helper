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
artifactKey: ${candidate.artifactKey}
symbol: ${candidate.symbolName}
file: ${candidate.filePath}
type: ${candidate.artifactType}
retrievalMethod: ${candidate.retrievalMethod}
retrievalReason: ${candidate.retrievalReason || 'Direct match'}
excerpt:
${candidate.excerpt}`;
      })
      .join('\n\n');

    return `UNTRUSTED_REPOSITORY_CONTENT_START\n${formatted}\nUNTRUSTED_REPOSITORY_CONTENT_END`;
  }
}
