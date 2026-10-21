import { dependencyEdgeProvenanceSchema } from '@ba-helper/contracts';
import { buildDependencyEdges } from './scan-persistence-mappers';

describe('dependency edge persistence mapping', () => {
  const ids = new Map([['source-key', 'source-id'], ['target-key', 'target-id']]);
  const edge = {
    fromArtifactId: 'source-key', toArtifactId: 'target-key', type: 'CALLS', confidence: 1,
    provenance: {
      resolver: 'TS_AST_DIRECT_CALL' as const,
      locations: [{ sourcePath: 'src/booking.service.ts', startLine: 10, endLine: 11 }],
    },
  };

  it('preserves resolver/locators and references source evidence in the same snapshot', () => {
    const result = buildDependencyEdges('snapshot-id', [edge], ids);
    expect(result.droppedEdgeCount).toBe(0);
    expect(result.edgesToPersist).toEqual([{
      snapshotId: 'snapshot-id', fromArtifactId: 'source-id', toArtifactId: 'target-id',
      type: 'CALLS', confidence: 1,
      metadata: {
        ...edge.provenance, kind: 'STATIC_SOURCE_REFERENCE',
        evidenceProvenanceKey: 'snapshot:snapshot-id:artifact:source-key',
      },
    }]);
  });

  it('retains zero confidence and permits legacy edges with unknown provenance', () => {
    const { provenance, ...legacy } = edge;
    expect(buildDependencyEdges('s', [{ ...legacy, confidence: 0 }], ids).edgesToPersist[0].confidence).toBe(0);
    expect(buildDependencyEdges('s', [legacy], ids).edgesToPersist[0].metadata).toBeUndefined();
  });

  it('rejects unsafe source paths and invalid confidence before publication', () => {
    expect(() => buildDependencyEdges('s', [{ ...edge, confidence: 2 }], ids)).toThrow();
    for (const sourcePath of ['../outside.ts', '/tmp/private.ts', 'C:\\checkout\\private.ts']) {
      expect(() => buildDependencyEdges('s', [{ ...edge,
        provenance: { ...edge.provenance, locations: [{ sourcePath, startLine: 1, endLine: 1 }] },
      }], ids)).toThrow();
    }
  });

  it('drops dangling and unsupported edges instead of creating substitute targets', () => {
    const result = buildDependencyEdges('s', [
      { ...edge, toArtifactId: 'missing' }, { ...edge, type: 'UNSUPPORTED' },
    ], ids);
    expect(result).toEqual({ edgesToPersist: [], droppedEdgeCount: 2 });
  });

  it('validates source ranges and bounded location samples', () => {
    const input = { ...edge.provenance, kind: 'STATIC_SOURCE_REFERENCE', evidenceProvenanceKey: 'e' };
    expect(dependencyEdgeProvenanceSchema.safeParse({ ...input,
      locations: [{ sourcePath: 'src/a.ts', startLine: 3, endLine: 2 }],
    }).success).toBe(false);
    expect(dependencyEdgeProvenanceSchema.safeParse({ ...input,
      locations: Array.from({ length: 21 }, () => input.locations[0]),
    }).success).toBe(false);
  });
});
