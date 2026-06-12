import { GetReviewQueueUseCase } from './get-review-queue.usecase';
import { ImpactGraphReadModelBuilder } from '../queries/impact-graph-read-model.builder';
import { QaCoverageDeriver } from '../qa/qa-coverage.deriver';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('GetReviewQueueUseCase', () => {
  let useCase: GetReviewQueueUseCase;
  let graphBuilder: jest.Mocked<ImpactGraphReadModelBuilder>;
  let qaDeriver: jest.Mocked<QaCoverageDeriver>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;

  beforeEach(() => {
    graphBuilder = {
      buildGraph: jest.fn(),
    } as any;
    qaDeriver = {
      derive: jest.fn(),
    } as any;
    insightRepo = {
      listByAnalysis: jest.fn(),
    } as any;
    traceabilityRepo = {
      listByAnalysis: jest.fn(),
    } as any;

    useCase = new GetReviewQueueUseCase(
      graphBuilder,
      qaDeriver,
      insightRepo,
      traceabilityRepo
    );
  });

  it('should rank items correctly and determine blocking properties', async () => {
    graphBuilder.buildGraph.mockResolvedValue({ nodes: [], edges: [], snapshotId: 'snap1' } as any);

    qaDeriver.derive.mockReturnValue({
      analysisId: 'analysis1',
      snapshotId: 'snap1',
      summary: { covered: 0, indirectOnly: 0, noTestFound: 1, highSeverityGaps: 1 },
      items: [
        {
          artifactId: 'art1',
          artifactKey: 'art1',
          artifactLabel: 'UserController',
          artifactType: 'CONTROLLER',
          filePath: '',
          status: 'NO_TEST_FOUND',
          severity: 'HIGH',
          testArtifacts: [],
          reason: 'gap',
          suggestedAction: 'add test'
        },
        {
          artifactId: 'art2',
          artifactKey: 'art2',
          artifactLabel: 'UserService',
          artifactType: 'SERVICE',
          filePath: '',
          status: 'NO_TEST_FOUND',
          severity: 'MEDIUM',
          testArtifacts: [],
          reason: 'gap',
          suggestedAction: 'scenario'
        }
      ]
    });

    insightRepo.listByAnalysis.mockResolvedValue([
      {
        id: 'insight-unknown',
        insightType: 'UNKNOWN',
        title: 'Unknown logic',
        description: 'missing rule',
        reviewStatus: 'NEEDS_REVIEW',
        evidenceLinks: [],
      } as any,
      {
        id: 'insight-strong',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        title: 'Clear impact',
        description: 'found it',
        reviewStatus: 'NEEDS_REVIEW',
        evidenceLinks: [{ evidence: { retrievalMetadata: { suggestion: { confidence: 'STRONG' } } } }],
      } as any,
      {
        id: 'insight-moderate',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        title: 'Maybe impact',
        description: 'found it',
        reviewStatus: 'NEEDS_REVIEW',
        evidenceLinks: [{ evidence: { retrievalMetadata: { suggestion: { confidence: 'MODERATE' } } } }],
      } as any,
      {
        id: 'insight-low',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        title: 'Low impact',
        description: 'found it',
        reviewStatus: 'NEEDS_REVIEW',
        evidenceLinks: [{ evidence: { retrievalMetadata: { suggestion: { confidence: 'WEAK' } } } }],
      } as any,
    ]);

    traceabilityRepo.listByAnalysis.mockResolvedValue([]);

    const result = await useCase.execute('analysis1');

    expect(result.summary.total).toBe(6);
    // 4 insights (blocking) + 0 traceability + 2 QA gaps (non-blocking)
    expect(result.summary.blockingRemaining).toBe(4);
    // high risk = HIGH QA gap (1) + UNKNOWN (1) + STRONG insight (1) = 3
    expect(result.summary.highRiskRemaining).toBe(3);

    // Verify ordering by rank
    expect(result.items[0].type).toBe('QA_COVERAGE_GAP');
    expect(result.items[0].priority).toBe('HIGH');
    expect(result.items[0].rank).toBe(100);

    expect(result.items[1].type).toBe('UNKNOWN');
    expect(result.items[1].priority).toBe('HIGH');
    expect(result.items[1].rank).toBe(90);

    expect(result.items[2].id).toBe('insight-strong');
    expect(result.items[2].priority).toBe('HIGH');
    expect(result.items[2].rank).toBe(80);

    expect(result.items[3].id).toBe('insight-moderate');
    expect(result.items[3].priority).toBe('MEDIUM');
    expect(result.items[3].rank).toBe(70);

    expect(result.items[4].type).toBe('QA_SCENARIO');
    expect(result.items[4].priority).toBe('MEDIUM');
    expect(result.items[4].rank).toBe(60);

    expect(result.items[5].id).toBe('insight-low');
    expect(result.items[5].priority).toBe('LOW');
    expect(result.items[5].rank).toBe(30);

    // Verify blocking logic
    expect(result.items[0].blockingFinalize).toBe(false); // QA Gap
    expect(result.items[1].blockingFinalize).toBe(true);  // UNKNOWN
  });

  it('should ignore CONFIRMED and REJECTED items', async () => {
    graphBuilder.buildGraph.mockResolvedValue({ nodes: [], edges: [], snapshotId: 'snap1' } as any);
    qaDeriver.derive.mockReturnValue({
      analysisId: 'a', snapshotId: 's', summary: {} as any, items: []
    });

    insightRepo.listByAnalysis.mockResolvedValue([
      { id: 'i1', reviewStatus: 'CONFIRMED' } as any,
      { id: 'i2', reviewStatus: 'REJECTED' } as any,
      { id: 'i3', reviewStatus: 'NEEDS_REVIEW' } as any,
    ]);
    traceabilityRepo.listByAnalysis.mockResolvedValue([]);

    const result = await useCase.execute('analysis1');
    expect(result.summary.total).toBe(1);
    expect(result.items[0].id).toBe('i3');
  });
});
