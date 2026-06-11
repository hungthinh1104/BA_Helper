export type GraphEdge = {
  stableId: string;
  type: string;
  from: string;
  to: string;
  confidence: number;
};

export type GraphResult = {
  edges: GraphEdge[];
};
