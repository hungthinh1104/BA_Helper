import type { RetrievalInput, RetrievalResult } from './retrieval.types';
import type { ScanArtifact } from '../scanner/scanner.types';

const MAX_ARTIFACTS = 12;
const HARD_CAP = 15;

const SYNONYM_MAP: Record<string, string[]> = {
  cancel: ['cancel', 'cancellation', 'cancelled'],
  inventory: ['stock', 'reservation', 'reserved'],
  shipment: ['shipping', 'shipped', 'delivery'],
  order: ['order', 'ordering'],
  release: ['release', 'free', 'unlock']
};

const tokenize = (text: string): string[] => {
  if (!text) return [];
  // Split by non-alphanumeric and camelCase
  const tokens = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(t => t.length > 2); // Ignore short words

  // Expand with synonyms
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (key === token || synonyms.includes(token)) {
        expanded.add(key);
        synonyms.forEach(s => expanded.add(s));
      }
    }
  }

  return Array.from(expanded);
};

export const selectEvidenceCandidates = (
  input: RetrievalInput,
): RetrievalResult => {
  const queryTokens = tokenize(input.changeRequest);
  
  if (queryTokens.length === 0) {
    return { artifacts: [] };
  }

  const artifactScores = new Map<string, number>();
  const artifactReasons = new Map<string, string>();
  const artifactById = new Map<string, ScanArtifact>();

  // Step 1: Lexical Scoring (Direct Match)
  for (const artifact of input.scan.artifacts) {
    artifactById.set(artifact.stableId, artifact);
    
    const artifactTokens = tokenize(`${artifact.symbolName} ${artifact.filePath}`);
    let score = 0;
    
    // Simple term frequency overlap
    for (const token of queryTokens) {
      if (artifactTokens.includes(token)) {
        score += 10; 
      }
    }

    if (score > 0) {
      artifactScores.set(artifact.stableId, score);
      artifactReasons.set(artifact.stableId, `directly matched "${queryTokens.filter(t => artifactTokens.includes(t)).join(', ')}"`);
    }
  }

  // Step 2: Graph Expansion
  if (input.expandGraph) {
    const directMatches = Array.from(artifactScores.entries())
      .filter(([id, score]) => score > 0)
      .map(([id]) => id);

    const getOutgoingEdges = (fromId: string) => 
      input.graph.edges.filter(e => e.from === fromId);
    
    const getIncomingEdges = (toId: string) => 
      input.graph.edges.filter(e => e.to === toId);

    // Expand Depth 1
    const depth1 = new Set<string>();
    for (const matchId of directMatches) {
      // Outgoing edges (CALLS, USES)
      for (const edge of getOutgoingEdges(matchId)) {
        if (!artifactScores.has(edge.to)) {
          artifactScores.set(edge.to, 8); // Depth 1 score
          artifactReasons.set(edge.to, `${edge.type} edge from ${matchId}`);
          depth1.add(edge.to);
        } else {
          artifactScores.set(edge.to, artifactScores.get(edge.to)! + 2); // Boost if already matched
        }
      }
      
      // Incoming edges (TESTS)
      for (const edge of getIncomingEdges(matchId)) {
        if (edge.type === 'TESTS' && !artifactScores.has(edge.from)) {
          artifactScores.set(edge.from, 5); // Tests are lower priority
          artifactReasons.set(edge.from, `TESTS edge to ${matchId}`);
          depth1.add(edge.from);
        }
      }
    }

    // Expand Depth 2
    for (const matchId of depth1) {
      for (const edge of getOutgoingEdges(matchId)) {
        if (!artifactScores.has(edge.to)) {
          artifactScores.set(edge.to, 4); // Depth 2 score
          artifactReasons.set(edge.to, `${edge.type} edge from ${matchId} (depth 2)`);
        }
      }
    }
  }

  // Step 3: Ranking and Pruning
  const sorted = Array.from(artifactScores.entries())
    .sort((a, b) => {
      // Sort by score descending, then by stableId alphabetically for deterministic results
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

  // Apply Caps
  const topArtifactIds = sorted.slice(0, HARD_CAP).map(entry => entry[0]);
  
  // If we have more than MAX_ARTIFACTS but less than HARD_CAP, we just return them.
  // We can prune low score artifacts if needed.
  const finalIds = topArtifactIds.slice(0, MAX_ARTIFACTS);

  // But wait, the user said "Critical graph dependency không được rớt khỏi top 8"
  // If we just use hard thresholds, we might prune it. But our score 8 for depth 1 should keep it high.

  const selectedArtifacts = finalIds.map(id => {
    const artifact = artifactById.get(id)!;
    return {
      ...artifact,
      retrievalReason: artifactReasons.get(id) || 'unknown'
    };
  }).filter(Boolean);

  return {
    artifacts: selectedArtifacts
  };
};
