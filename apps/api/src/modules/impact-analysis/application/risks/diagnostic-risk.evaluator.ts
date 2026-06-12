export class DiagnosticRiskEvaluator {
  static getPropagationMode(diagnostic: {
    code: string;
    severity?: string;
    category?: string;
    payload?: { candidateTerms?: string[]; [key: string]: unknown };
  }): 'NONE' | 'LEXICAL' | 'CONTEXT' {
    if (diagnostic.code === 'SCANNER_CAPABILITY_SUMMARY' || diagnostic.severity === 'INFO') {
      return 'NONE';
    }

    const code = diagnostic.code;
    if (
      code.includes('_NOT_EXTRACTED') ||
      code.includes('_BOUNDARY') ||
      code.includes('_RESOLUTION_BOUNDARY') ||
      code.includes('DI_BOUNDARY') ||
      diagnostic.category === 'LIMIT' ||
      diagnostic.category === 'FILE_SYSTEM' ||
      diagnostic.category === 'SECURITY' ||
      code.includes('FILE_LIMIT') ||
      code.includes('REPO_LIMIT') ||
      code.includes('TOO_LARGE') ||
      code.includes('SKIPPED')
    ) {
      return 'CONTEXT';
    }

    if (
      diagnostic.payload?.candidateTerms?.length &&
      (
        code.includes('UNKNOWN_ROUTER_PATTERN') ||
        code.includes('ROUTE_UNSUPPORTED') ||
        code.includes('DYNAMIC_ROUTE_UNSUPPORTED') ||
        code.includes('RESOURCE_ROUTE_UNSUPPORTED') ||
        code.includes('UNSUPPORTED')
      )
    ) {
      return 'LEXICAL';
    }

    return 'NONE';
  }

  static buildStructuredInsightKey(diagnostic: {
    code: string;
    payload?: { candidateTerms?: string[]; relativePath?: string; unsupportedPattern?: string; [key: string]: unknown };
    samplePaths?: string[];
  }): string {
    const candidateTerms = [...(diagnostic.payload?.candidateTerms ?? [])].sort().join(',');
    const filePath = diagnostic.payload?.relativePath || diagnostic.samplePaths?.[0] || 'unknown';
    const unsupportedPattern = diagnostic.payload?.unsupportedPattern || 'unknown';
    return `${diagnostic.code}::${filePath}::${unsupportedPattern}::${candidateTerms}`;
  }

  /**
   * Deterministically evaluates if any of the candidate terms derived from an unsupported
   * scanner diagnostic match the normalized requirement text.
   *
   * Normalization rules:
   * 1. Convert to lowercase.
   * 2. Strip common contextual suffixes (Controller, Service, Route, _id).
   * 3. Stem basic plurals (e.g., 's' -> '').
   */
  static isRelevant(requirementText: string, candidateTerms: string[]): boolean {
    if (!candidateTerms || candidateTerms.length === 0) {
      return false;
    }

    const normalizedReq = requirementText.toLowerCase();

    for (const term of candidateTerms) {
      if (!term) continue;

      const normalizedTerm = this.normalizeTerm(term);
      if (!normalizedTerm) continue;

      // Blocklist common generic routing prefixes so they never trigger a false-positive risk
      const blocklist = ['api', 'v1', 'v2', 'admin', 'web', 'app', 'core', 'public'];
      if (blocklist.includes(normalizedTerm)) {
        continue;
      }

      // Check if the normalized term exists in the requirement text as a whole word boundary
      // Note: non-word boundaries might apply if it's a sub-string, but user specifically asked for "refunds -> refund", "booking_id -> booking".
      // Simple regex for word boundary matching the normalized stem
      const regex = new RegExp(`\\b${this.escapeRegExp(normalizedTerm)}(?:s|es)?\\b`, 'i');
      
      if (regex.test(normalizedReq)) {
        return true;
      }
    }

    return false;
  }

  private static normalizeTerm(term: string): string {
    let t = term.toLowerCase();
    
    // Strip common architectural and contextual suffixes
    t = t.replace(/controller$/, '');
    t = t.replace(/service$/, '');
    t = t.replace(/route$/, '');
    t = t.replace(/handler$/, '');
    t = t.replace(/_id$/, '');
    t = t.replace(/id$/, '');

    // Basic singularization
    if (t.endsWith('ies')) {
      t = t.substring(0, t.length - 3) + 'y';
    } else if (
      t.endsWith('s') && 
      !t.endsWith('ss') && 
      !t.endsWith('us') && 
      !t.endsWith('is') && 
      !t.endsWith('as') && 
      !t.endsWith('os')
    ) {
      t = t.substring(0, t.length - 1);
    }

    return t.trim();
  }

  private static escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
}
