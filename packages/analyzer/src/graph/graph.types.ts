export type GraphEdge = {
  stableId: string;
  type: string;
  from: string;
  to: string;
  confidence: number;
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
