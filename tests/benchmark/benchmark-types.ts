export enum BenchmarkFailureClass {
  SCANNER_MISS = 'SCANNER_MISS',
  GRAPH_EDGE_MISS = 'GRAPH_EDGE_MISS',
  RETRIEVAL_MISS = 'RETRIEVAL_MISS',
  RETRIEVAL_NOISE = 'RETRIEVAL_NOISE',
  AI_HALLUCINATION = 'AI_HALLUCINATION',
  AI_MISCLASSIFIED_UNKNOWN = 'AI_MISCLASSIFIED_UNKNOWN',
  REPORT_OMITS_EVIDENCE = 'REPORT_OMITS_EVIDENCE',
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  EVIDENCE_GROUNDING_VIOLATION = 'EVIDENCE_GROUNDING_VIOLATION',
  RANKING_WEAK = 'RANKING_WEAK'
}

export interface BenchmarkMismatch {
  failureClass: BenchmarkFailureClass;
  expected: string;
  actual: string;
  details: string;
}

export interface BenchmarkReport {
  fixtureName: string;
  totalMismatches: number;
  mismatches: BenchmarkMismatch[];
}
