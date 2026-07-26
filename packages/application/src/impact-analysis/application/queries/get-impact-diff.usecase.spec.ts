import { GetImpactDiff } from './get-impact-diff.usecase';
import type {
  ImpactDiffRepositoryPort,
  ImpactDiffAnalysisRecord,
  ImpactDiffArtifactLink,
  ImpactDiffInsightRecord,
} from '../../ports/impact-diff.repository.port';

const link = (artifactKey: string): ImpactDiffArtifactLink => ({
  reviewStatus: 'CONFIRMED',
  artifact: {
    artifactKey,
    name: artifactKey,
    artifactType: 'SERVICE_METHOD',
    universalKind: 'DOMAIN_SERVICE',
    filePath: `src/${artifactKey}.ts`,
  },
});

const unknown = (id: string, insightKey: string, description: string): ImpactDiffInsightRecord => ({
  id,
  insightKey,
  insightType: 'UNKNOWN',
  title: insightKey,
  description,
  reviewStatus: 'NEEDS_REVIEW',
});

function makeRepository(config: {
  analyses: Record<string, ImpactDiffAnalysisRecord>;
  links?: Record<string, ImpactDiffArtifactLink[]>;
  insights?: Record<string, ImpactDiffInsightRecord[]>;
  clarifications?: Record<string, string | null>;
}): ImpactDiffRepositoryPort {
  return {
    getAnalysis: async (id) => config.analyses[id] ?? null,
    getAffectedArtifactLinks: async (id) => config.links?.[id] ?? [],
    getDiffInsights: async (id) => config.insights?.[id] ?? [],
    getClarificationSourceInsightId: async (id) => config.clarifications?.[id] ?? null,
  };
}

const baseAnalysis: ImpactDiffAnalysisRecord = {
  id: 'base',
  derivedFromAnalysisId: null,
  status: 'COMPLETED',
  requirementRevisionId: 'r1',
  snapshotId: 's1',
  sourceClarificationId: null,
  reviewClarificationRequestId: null,
  snapshot: { commitSha: 'c1' },
};

const currentAnalysis: ImpactDiffAnalysisRecord = {
  id: 'cur',
  derivedFromAnalysisId: 'base',
  status: 'WAITING_FOR_REVIEW',
  requirementRevisionId: 'r2',
  snapshotId: 's2',
  sourceClarificationId: 'clar-1',
  reviewClarificationRequestId: null,
  snapshot: { commitSha: 'c2' },
};

describe('GetImpactDiff', () => {
  it('rejects an analysis without a baseline', async () => {
    const repo = makeRepository({
      analyses: { orphan: { ...baseAnalysis, id: 'orphan', derivedFromAnalysisId: null } },
    });
    await expect(new GetImpactDiff(repo).execute('orphan')).rejects.toMatchObject({
      code: 'NO_BASELINE_ANALYSIS',
    });
  });

  it('reports a missing current analysis', async () => {
    const result = await new GetImpactDiff(makeRepository({ analyses: {} })).computeForAnalysis('nope');
    expect(result).toEqual({ computable: false, reason: 'CURRENT_ANALYSIS_MISSING' });
  });

  it('diffs artifacts and insights and resolves unknowns via clarification lineage', async () => {
    const repo = makeRepository({
      analyses: { base: baseAnalysis, cur: currentAnalysis },
      links: {
        base: [link('A'), link('B')],
        cur: [link('A'), link('C')],
      },
      insights: {
        base: [
          unknown('insight-resolved', 'u-resolved', 'Refund window unclear'),
          unknown('insight-removed', 'u-removed', 'Legacy question'),
        ],
        cur: [
          unknown('insight-new', 'u-new', 'Inventory timing unclear'),
          {
            id: 'insight-qa',
            insightKey: 'qa-1',
            insightType: 'QA_SCENARIO',
            title: 'Refund happens once',
            description: 'Given a paid booking, when cancelled, then a single refund is created.',
            reviewStatus: 'NEEDS_REVIEW',
          },
        ],
      },
      // The current analysis's clarification traces back to the resolved unknown.
      clarifications: { 'clar-1': 'insight-resolved' },
    });

    const diff = await new GetImpactDiff(repo).execute('cur');

    expect(diff.addedArtifacts.map((a) => a.artifactKey)).toEqual(['C']);
    expect(diff.removedArtifacts.map((a) => a.artifactKey)).toEqual(['B']);
    expect(diff.unchangedArtifacts.map((a) => a.artifactKey)).toEqual(['A']);

    expect(diff.resolvedUnknowns.map((i) => i.insightKey)).toEqual(['u-resolved']);
    expect(diff.removedUnknowns.map((i) => i.insightKey)).toEqual(['u-removed']);
    expect(diff.newUnknowns.map((i) => i.insightKey)).toEqual(['u-new']);
    expect(diff.addedQaScenarios.map((i) => i.insightKey)).toEqual(['qa-1']);

    expect(diff.summary).toEqual({
      addedImpacts: 1,
      removedImpacts: 1,
      unchangedImpacts: 1,
      resolvedUnknowns: 1,
      removedUnknowns: 1,
      newUnknowns: 1,
      addedQaScenarios: 1,
    });

    // snapshot changed (s1 -> s2) surfaces a diagnostic.
    expect(diff.diagnostics).toEqual([
      expect.objectContaining({ code: 'SNAPSHOT_CHANGED', severity: 'WARN' }),
    ]);
    expect(diff.comparisonContext.snapshotChanged).toBe(true);
    expect(diff.comparisonContext.sourceClarificationId).toBe('clar-1');
  });
});
