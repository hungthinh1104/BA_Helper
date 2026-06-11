import { GraphPolicy } from './graph.policy';

describe('GraphPolicy', () => {
  describe('validateEdge', () => {
    it('throws if edge is a self-edge', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: 'node-A',
          toId: 'node-A',
          edgeType: 'CALLS',
        });
      }).toThrow('A graph node cannot have an edge to itself.');
    });

    it('throws if source or target is missing', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: '',
          toId: 'node-B',
          edgeType: 'CALLS',
        });
      }).toThrow('Graph edge must have both source and target nodes.');
    });

    it('throws if edge type is unknown', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: 'node-A',
          toId: 'node-B',
          edgeType: 'MAGICAL_EDGE',
        });
      }).toThrow('Edge type MAGICAL_EDGE is not allowed.');
    });

    it('passes for allowed cyclic edges even if they form a cycle', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: 'node-C',
          toId: 'node-A',
          edgeType: 'CALLS',
          existingEdges: [
            { fromId: 'node-A', toId: 'node-B', type: 'CALLS' },
            { fromId: 'node-B', toId: 'node-C', type: 'CALLS' },
          ],
        });
      }).not.toThrow(); // CALLS is not an acyclic edge type
    });

    it('throws if an acyclic edge introduces a cycle', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: 'node-C',
          toId: 'node-A',
          edgeType: 'REQUIREMENT_TO_ANALYSIS',
          existingEdges: [
            { fromId: 'node-A', toId: 'node-B', type: 'REQUIREMENT_TO_ANALYSIS' },
            { fromId: 'node-B', toId: 'node-C', type: 'REQUIREMENT_TO_ANALYSIS' },
          ],
        });
      }).toThrow('Adding edge node-C -> node-A of type REQUIREMENT_TO_ANALYSIS introduces a cycle.');
    });

    it('passes for an acyclic edge if it does not introduce a cycle', () => {
      expect(() => {
        GraphPolicy.validateEdge({
          fromId: 'node-C',
          toId: 'node-D',
          edgeType: 'REQUIREMENT_TO_ANALYSIS',
          existingEdges: [
            { fromId: 'node-A', toId: 'node-B', type: 'REQUIREMENT_TO_ANALYSIS' },
            { fromId: 'node-B', toId: 'node-C', type: 'REQUIREMENT_TO_ANALYSIS' },
          ],
        });
      }).not.toThrow();
    });
  });
});
