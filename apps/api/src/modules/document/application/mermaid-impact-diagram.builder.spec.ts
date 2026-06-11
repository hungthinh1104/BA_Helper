import { MermaidImpactDiagramBuilder, ReportDependencyEdge } from './mermaid-impact-diagram.builder';

describe('MermaidImpactDiagramBuilder', () => {
  let builder: MermaidImpactDiagramBuilder;

  beforeEach(() => {
    builder = new MermaidImpactDiagramBuilder();
  });

  it('builds valid Mermaid for simple traceability flow', () => {
    const requirement = { title: 'Cancel booking' } as unknown as import('@prisma/client').RequirementRevision;
    const traceabilityLinks = [
      {
        reviewStatus: 'CONFIRMED',
        artifact: { id: 'a1', name: 'BookingController.cancel', artifactType: 'CONTROLLER_METHOD' },
      },
      {
        reviewStatus: 'CONFIRMED',
        artifact: { id: 'a2', name: 'BookingService.cancelBooking', artifactType: 'SERVICE_METHOD' },
      },
    ] as unknown as any[];
    
    const dependencyEdges: ReportDependencyEdge[] = [
      { id: 'e1', snapshotId: 's1', fromArtifactId: 'a1', toArtifactId: 'a2', type: 'CALLS' },
    ];
    
    const insights = [] as any[];

    const result = builder.build({ requirement, traceabilityLinks, dependencyEdges, insights });
    
    expect(result.mermaid).toContain('```mermaid');
    expect(result.mermaid).toContain('flowchart TD');
    expect(result.mermaid).toContain('n_req["[Requirement] Cancel booking"]');
    expect(result.mermaid).toContain('["[API] BookingController.cancel"]');
    expect(result.mermaid).toContain('["[Service] BookingService.cancelBooking"]');
    expect(result.mermaid).toContain('-->|CALLS|');
    expect(result.isTruncated).toBe(false);
  });

  it('escapes unsafe labels', () => {
    const requirement = { title: 'Test "Quotes" & [Brackets] \n Newline' } as unknown as import('@prisma/client').RequirementRevision;
    const result = builder.build({ requirement, traceabilityLinks: [], dependencyEdges: [], insights: [] });
    
    expect(result.mermaid).toContain('n_req["[Requirement] Test Quotes & Brackets Newline"]');
  });

  it('caps large graphs and omits dangling edges', () => {
    const requirement = { title: 'Large Feature' } as unknown as import('@prisma/client').RequirementRevision;
    const traceabilityLinks = Array.from({ length: 25 }).map((_, i) => ({
      reviewStatus: 'CONFIRMED',
      artifact: { id: `a${i}`, name: `Artifact ${i}`, artifactType: 'ENTITY' },
    })) as unknown as any[];
    
    // Create an edge from node 0 (kept) to node 24 (capped)
    const dependencyEdges: ReportDependencyEdge[] = [
      { id: 'e1', snapshotId: 's1', fromArtifactId: 'a0', toArtifactId: 'a24', type: 'USES' },
    ];

    const result = builder.build({ requirement, traceabilityLinks, dependencyEdges, insights: [] });
    
    expect(result.isTruncated).toBe(true);
    // Node 24 should not be in diagram
    expect(result.mermaid).not.toContain('Artifact 24');
    // Edge should be omitted because target is missing
    expect(result.mermaid).not.toContain('USES');
  });

  it('excludes rejected items', () => {
    const requirement = { title: 'Req' } as unknown as import('@prisma/client').RequirementRevision;
    const traceabilityLinks = [
      {
        reviewStatus: 'REJECTED',
        artifact: { id: 'a1', name: 'BadArtifact', artifactType: 'ENTITY' },
      },
    ] as unknown as any[];

    const result = builder.build({ requirement, traceabilityLinks, dependencyEdges: [], insights: [] });
    expect(result.mermaid).not.toContain('BadArtifact');
  });
});
