import { GetQaCoverageUseCase } from './get-qa-coverage.usecase';
import { QaCoverageDeriver } from './qa-coverage.deriver';
import { ImpactGraphReadModelBuilder } from '../queries/impact-graph-read-model.builder';
import { ImpactGraphResponse, ImpactGraphNode, ImpactGraphEdge, QaCoverageItem } from '@ba-helper/contracts';

describe('GetQaCoverageUseCase', () => {
  let useCase: GetQaCoverageUseCase;
  let mockBuilder: jest.Mocked<ImpactGraphReadModelBuilder>;
  let mockDeriver: jest.Mocked<QaCoverageDeriver>;

  beforeEach(() => {
    mockBuilder = {
      buildGraph: jest.fn(),
    } as any;
    mockDeriver = new QaCoverageDeriver() as any;
    useCase = new GetQaCoverageUseCase(mockBuilder, mockDeriver);
  });

  const createNode = (id: string, type: string, label: string): ImpactGraphNode => ({
    id, type: type as any, label, 
    artifactKey: id,
    certainty: "EVIDENCED", reviewStatus: "CONFIRMED", 
    evidenceSummary: "", source: "TRACEABILITY"
  });

  const createEdge = (id: string, source: string, target: string, type: string, displayDirectionReversed?: boolean): ImpactGraphEdge => ({
    id, source, target, type: type as any, sourceKind: "DEPENDENCY", displayDirectionReversed
  });

  it('should identify COVERED and NO_TEST_FOUND artifacts properly', async () => {
    const graphData: ImpactGraphResponse = {
      analysisId: "test-id", snapshotId: "snap-id",
      nodes: [
        createNode("artifact-api", "API_ROUTE", "Cancel Booking API"),
        createNode("artifact-svc", "SERVICE_METHOD", "cancelBooking"),
        createNode("artifact-test", "TEST", "cancelBooking.spec.ts")
      ],
      edges: [
        // TEST edge: API is covered (source is api, target is test)
        createEdge("edge-1", "artifact-api", "artifact-test", "TESTS")
      ]
    };
    mockBuilder.buildGraph.mockResolvedValue(graphData);

    const result = await useCase.execute('test-id');
    const coverage = result.items;
    
    expect(coverage).toHaveLength(2); // Only API and SERVICE_METHOD monitored

    const apiItem = coverage.find(c => c.artifactId === "api")!;
    expect(apiItem.status).toBe("COVERED");
    expect(apiItem.severity).toBe("HIGH");
    expect(apiItem.testArtifacts[0].id).toBe("test");

    const svcItem = coverage.find(c => c.artifactId === "svc")!;
    expect(svcItem.status).toBe("NO_TEST_FOUND");
    expect(svcItem.severity).toBe("HIGH");
  });

  it('should mark as COVERED regardless of TEST edge visual direction', async () => {
    const graphData: ImpactGraphResponse = {
      analysisId: "test-id", snapshotId: "snap-id",
      nodes: [
        createNode("artifact-entity", "ENTITY", "Booking"),
        createNode("artifact-test", "TEST", "booking.spec.ts")
      ],
      edges: [
        // TEST edge: visually reversed, target is source, entity is target
        createEdge("edge-1", "artifact-test", "artifact-entity", "TESTS", true)
      ]
    };
    mockBuilder.buildGraph.mockResolvedValue(graphData);

    const result = await useCase.execute('test-id');
    const coverage = result.items;
    expect(coverage).toHaveLength(1);

    const entityItem = coverage[0];
    expect(entityItem.status).toBe("COVERED");
    expect(entityItem.severity).toBe("LOW");
  });

  it('should identify INDIRECT_ONLY coverage', async () => {
    const graphData: ImpactGraphResponse = {
      analysisId: "test-id", snapshotId: "snap-id",
      nodes: [
        createNode("artifact-ctrl", "CONTROLLER", "BookingController"),
        createNode("artifact-svc", "SERVICE", "BookingService"),
        createNode("artifact-test", "TEST", "controller.spec.ts")
      ],
      edges: [
        // Controller is covered directly
        createEdge("edge-1", "artifact-ctrl", "artifact-test", "TESTS"),
        // Controller calls Service
        createEdge("edge-2", "artifact-ctrl", "artifact-svc", "CALLS")
      ]
    };
    mockBuilder.buildGraph.mockResolvedValue(graphData);

    const result = await useCase.execute('test-id');
    const coverage = result.items;
    expect(coverage).toHaveLength(2);

    const ctrlItem = coverage.find(c => c.artifactId === "ctrl")!;
    expect(ctrlItem.status).toBe("COVERED");
    
    const svcItem = coverage.find(c => c.artifactId === "svc")!;
    expect(svcItem.status).toBe("INDIRECT_ONLY");
    expect(svcItem.severity).toBe("MEDIUM");
  });

  it('should sort correctly: NO_TEST_FOUND > INDIRECT > COVERED, then HIGH > MEDIUM > LOW', async () => {
    const graphData: ImpactGraphResponse = {
      analysisId: "test-id", snapshotId: "snap-id",
      nodes: [
        createNode("artifact-1", "ENTITY", "E1"), // NO_TEST_FOUND LOW
        createNode("artifact-2", "API_ROUTE", "A1"), // COVERED HIGH
        createNode("artifact-3", "SERVICE_METHOD", "S1"), // NO_TEST_FOUND HIGH
        createNode("artifact-4", "SERVICE", "S2"), // INDIRECT MEDIUM
        createNode("artifact-test", "TEST", "T")
      ],
      edges: [
        createEdge("e1", "artifact-2", "artifact-test", "TESTS"),
        createEdge("e2", "artifact-2", "artifact-4", "USES")
      ]
    };
    mockBuilder.buildGraph.mockResolvedValue(graphData);

    const result = await useCase.execute('test-id');
    const coverage = result.items;
    
    expect(coverage[0].artifactId).toBe("3"); // NO_TEST_FOUND HIGH
    expect(coverage[1].artifactId).toBe("1"); // NO_TEST_FOUND LOW
    expect(coverage[2].artifactId).toBe("4"); // INDIRECT_ONLY MEDIUM
    expect(coverage[3].artifactId).toBe("2"); // COVERED HIGH
  });
});
