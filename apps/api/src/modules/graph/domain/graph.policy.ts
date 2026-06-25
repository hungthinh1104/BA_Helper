import { AppError } from '@ba-helper/shared';

export const ACYCLIC_EDGE_TYPES = [
  'REQUIREMENT_TO_ANALYSIS',
  'ANALYSIS_TO_REVIEW_DECISION',
  'REVIEW_DECISION_TO_CLARIFICATION',
  'CLARIFICATION_TO_DERIVED_ANALYSIS',
] as const;

export const ALLOWED_EDGE_TYPES = [
  ...ACYCLIC_EDGE_TYPES,
  'IMPORTS',
  'CALLS',
  'INJECTS',
  'IMPLEMENTS',
  'TESTS',
  'AFFECTS',
  'RELATED_TO',
];

export const GraphPolicy = {
  validateEdge: (params: {
    fromId: string;
    toId: string;
    edgeType: string;
    existingEdges?: Array<{ fromId: string; toId: string; type: string }>;
  }) => {
    // 1. No self-edge
    if (params.fromId === params.toId) {
      throw new AppError('GRAPH_SELF_EDGE', 'A graph node cannot have an edge to itself.');
    }

    // 2. Edge source and target must exist (they are strings, but we ensure they aren't empty)
    if (!params.fromId || !params.toId) {
      throw new AppError('GRAPH_MISSING_NODE', 'Graph edge must have both source and target nodes.');
    }

    // 3. Edge type must be allowed
    if (!(ALLOWED_EDGE_TYPES as readonly string[]).includes(params.edgeType)) {
      throw new AppError('GRAPH_UNKNOWN_EDGE_TYPE', `Edge type ${params.edgeType} is not allowed.`);
    }

    // 4. Acyclic edge types must not introduce cycles
    if ((ACYCLIC_EDGE_TYPES as readonly string[]).includes(params.edgeType) && params.existingEdges) {
      const graph = new Map<string, Set<string>>();
      
      // Build adjacency list
      for (const edge of params.existingEdges) {
        if ((ACYCLIC_EDGE_TYPES as readonly string[]).includes(edge.type)) {
          if (!graph.has(edge.fromId)) graph.set(edge.fromId, new Set());
          graph.get(edge.fromId)!.add(edge.toId);
        }
      }
      
      // Add the new edge
      if (!graph.has(params.fromId)) graph.set(params.fromId, new Set());
      graph.get(params.fromId)!.add(params.toId);

      // DFS to detect cycle
      const visited = new Set<string>();
      const recStack = new Set<string>();

      const isCyclic = (node: string): boolean => {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recStack.add(node);

        const neighbors = graph.get(node) || new Set();
        for (const neighbor of neighbors) {
          if (isCyclic(neighbor)) return true;
        }

        recStack.delete(node);
        return false;
      };

      for (const node of graph.keys()) {
        if (isCyclic(node)) {
          throw new AppError('GRAPH_CYCLE_DETECTED', `Adding edge ${params.fromId} -> ${params.toId} of type ${params.edgeType} introduces a cycle.`);
        }
      }
    }
  },
};
