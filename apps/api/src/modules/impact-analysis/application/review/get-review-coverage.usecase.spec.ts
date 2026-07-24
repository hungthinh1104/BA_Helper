import { GetReviewCoverageUseCase } from './get-review-coverage.usecase';

describe('GetReviewCoverageUseCase', () => {
  let useCase: GetReviewCoverageUseCase;
  let prismaMock: any;
  let permissionServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      multiRepoAnalysisRun: {
        findUnique: jest.fn(),
      },
    };
    permissionServiceMock = {
      assertCanReadMultiRepoRun: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new GetReviewCoverageUseCase(prismaMock as any, permissionServiceMock as any);
  });

  const mockActor: any = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'ADMIN' };
  const runId = 'run-1';

  it('PASS when all child analyses are accepted, artifacts have evidence, and risks have QA', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            { artifactId: 'art-1', evidenceLinks: [{ evidenceId: 'ev-1' }] },
          ],
          insights: [
            { id: 'risk-1', insightType: 'UNKNOWN', certainty: 'INFERRED', evidenceLinks: [{ evidenceId: 'ev-2' }] },
            { id: 'qa-1', insightType: 'QA_SCENARIO', evidenceLinks: [{ evidenceId: 'ev-2' }] },
          ],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('PASS');
    expect(result.summary.warningGates).toBe(0);
    expect(result.summary.blockingGates).toBe(0);
    expect(result.gates.every((g) => g.status === 'PASS')).toBe(true);
  });

  it('counts metadata risk insights when checking QA coverage', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            { artifactId: 'art-1', evidenceLinks: [{ evidenceId: 'ev-1' }] },
          ],
          insights: [
            {
              id: 'risk-1',
              insightType: 'CLAIM',
              certainty: 'INFERRED',
              metadata: { kind: 'RISK' },
              evidenceLinks: [{ evidenceId: 'ev-2' }],
            },
            { id: 'qa-1', insightType: 'QA_SCENARIO', evidenceLinks: [{ evidenceId: 'ev-2' }] },
          ],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);

    expect(result.summary.risks).toBe(1);
    expect(result.summary.risksWithQa).toBe(1);
    expect(result.summary.risksWithoutQa).toBe(0);
    expect(result.gates.find((g) => g.category === 'QA_COVERAGE')?.status).toBe('PASS');
  });

  it('FAIL when any child analysis has no review decision', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [],
          traceabilityLinks: [],
          insights: [],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('FAIL');
    const decisionGate = result.gates.find((g) => g.category === 'REVIEW_DECISION');
    expect(decisionGate?.status).toBe('FAIL');
  });

  it('FAIL when latest child decision is REJECTED', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'REJECTED' }],
          traceabilityLinks: [],
          insights: [],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('FAIL');
    const decisionGate = result.gates.find((g) => g.category === 'REVIEW_DECISION');
    expect(decisionGate?.status).toBe('FAIL');
  });

  it('FAIL when latest child decision is NEEDS_MORE_CLARIFICATION', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'NEEDS_MORE_CLARIFICATION' }],
          traceabilityLinks: [],
          insights: [],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('FAIL');
    const decisionGate = result.gates.find((g) => g.category === 'REVIEW_DECISION');
    expect(decisionGate?.status).toBe('FAIL');
  });

  it('WARN when impacted artifact has no evidence', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            { artifactId: 'art-1', evidenceLinks: [] },
          ],
          insights: [],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('WARN');
    const gate = result.gates.find((g) => g.category === 'EVIDENCE_COVERAGE');
    expect(gate?.status).toBe('WARN');
    expect(gate?.affectedArtifactIds).toContain('art-1');
  });

  it('WARN when risk has no QA scenario sharing evidenceId', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            { artifactId: 'art-1', evidenceLinks: [{ evidenceId: 'ev-1' }] },
          ],
          insights: [
            { id: 'risk-1', insightType: 'UNKNOWN', certainty: 'INFERRED', evidenceLinks: [{ evidenceId: 'ev-risk' }] },
            { id: 'qa-1', insightType: 'QA_SCENARIO', evidenceLinks: [{ evidenceId: 'ev-qa' }] }, // Different evidence!
          ],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('WARN');
    const gate = result.gates.find((g) => g.category === 'QA_COVERAGE');
    expect(gate?.status).toBe('WARN');
    expect(gate?.affectedInsightIds).toContain('risk-1');
  });

  it('WARN when repository has risks but zero QA scenarios', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            { artifactId: 'art-1', evidenceLinks: [{ evidenceId: 'ev-1' }] },
          ],
          insights: [
            { id: 'risk-1', insightType: 'UNKNOWN', certainty: 'INFERRED', evidenceLinks: [{ evidenceId: 'ev-risk' }] },
            // No QA scenarios at all
          ],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('WARN');
    const gate = result.gates.find((g) => g.category === 'RISK_COVERAGE');
    expect(gate?.status).toBe('WARN');
    expect(gate?.affectedRepositoryIds).toContain('repo-1');
  });

  it('WARN when accepted analysis has zero impacted artifacts', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [], // Zero artifacts
          insights: [],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('WARN');
    const gate = result.gates.find((g) => g.category === 'REPOSITORY_READINESS');
    expect(gate?.status).toBe('WARN');
    expect(gate?.affectedRepositoryIds).toContain('repo-1');
  });

  it('do not link risk to QA by text: if both contain similar words but do not share evidenceId, the risk remains uncovered', async () => {
    prismaMock.multiRepoAnalysisRun.findUnique.mockResolvedValue({
      id: runId,
      analyses: [
        {
          id: 'analysis-1',
          sourceTarget: { repositoryId: 'repo-1' },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
             { artifactId: 'art-1', evidenceLinks: [{ evidenceId: 'ev-1' }] },
          ],
          insights: [
            // They share text but not evidenceId
            { id: 'risk-1', insightType: 'UNKNOWN', title: 'DB Timeout', evidenceLinks: [{ evidenceId: 'ev-1' }] },
            { id: 'qa-1', insightType: 'QA_SCENARIO', title: 'DB Timeout', evidenceLinks: [{ evidenceId: 'ev-2' }] },
          ],
        },
      ],
    });

    const result = await useCase.execute(mockActor, runId);
    expect(result.status).toBe('WARN');
    const gate = result.gates.find((g) => g.category === 'QA_COVERAGE');
    expect(gate?.status).toBe('WARN');
    expect(gate?.affectedInsightIds).toContain('risk-1');
  });
});
