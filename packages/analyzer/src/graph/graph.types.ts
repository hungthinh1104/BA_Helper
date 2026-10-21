export type GraphProvenance = {
  resolver: 'TS_AST_DIRECT_CALL' | 'TS_AST_ENTITY_REFERENCE';
  locations: Array<{ sourcePath: string; startLine: number; endLine: number }>;
  omittedLocationCount?: number;
};

export type GraphEdge = {
  stableId: string;
  type: string;
  from: string;
  to: string;
  confidence: number;
  provenance?: GraphProvenance;
};

export type GraphDiagnostic = {
  code: string;
  message: string;
  filePath?: string;
  sourceSymbol?: string;
  targetExpression?: string;
};

export type GraphResult = {
  edges: GraphEdge[];
  diagnostics?: GraphDiagnostic[];
};
