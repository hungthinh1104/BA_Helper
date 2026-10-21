import { QA_TRACE_LIMITS } from './qa-trace.types';
import type { ValidatedQaTraceEdge } from './qa-trace.types';

/** Reverse BFS chooses one shortest source path per case; no layout edges are used. */
export function findQaTestPaths(targetId: string, incoming: Map<string, ValidatedQaTraceEdge[]>) {
  const queue: Array<{ id: string; trail: ValidatedQaTraceEdge[] }> = [{ id: targetId, trail: [] }];
  const visited = new Set([targetId]);
  const cases = new Set<string>();
  const paths: ValidatedQaTraceEdge[][] = [];
  let depthLimited = false;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { id, trail } = queue[cursor];
    for (const edge of incoming.get(id) ?? []) {
      if (edge.type === 'TESTS') {
        if (cases.has(edge.fromArtifactId)) continue;
        if (paths.length === QA_TRACE_LIMITS.maxTracesPerArtifact) {
          return { paths, truncated: true, depthLimited };
        }
        cases.add(edge.fromArtifactId);
        paths.push([edge, ...trail]);
      } else if (!visited.has(edge.fromArtifactId)) {
        if (trail.length === QA_TRACE_LIMITS.maxCallDepth) { depthLimited = true; continue; }
        visited.add(edge.fromArtifactId);
        queue.push({ id: edge.fromArtifactId, trail: [edge, ...trail] });
      }
    }
  }
  return { paths, truncated: false, depthLimited };
}
