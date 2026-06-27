import { Test, TestingModule } from '@nestjs/testing';
import { ImpactAnalysisReadModelController } from './impact-analysis-read-model.controller';
import type { ProjectPermissionService } from '../../project/application/project-permission.service';
import type { GetAnalysisDriftFreshnessUseCase } from '../application/queries/get-analysis-drift-freshness.usecase';
import type { GetAnalysisWorkspaceUseCase } from '../application/queries/get-analysis-workspace.usecase';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@ba-helper/contracts';

describe('ImpactAnalysisReadModelController - driftFreshness', () => {
  let controller: ImpactAnalysisReadModelController;
  let permissions: jest.Mocked<ProjectPermissionService>;
  let getAnalysisDriftFreshness: jest.Mocked<GetAnalysisDriftFreshnessUseCase>;
  let getAnalysisWorkspace: jest.Mocked<GetAnalysisWorkspaceUseCase>;

  const mockActor: RequestUser = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'VIEWER' };

  beforeEach(async () => {
    permissions = {
      assertCanReadAnalysis: jest.fn(),
    } as any;

    getAnalysisDriftFreshness = {
      execute: jest.fn(),
    } as any;
    getAnalysisWorkspace = {
      execute: jest.fn(),
    } as any;

    controller = new ImpactAnalysisReadModelController(
      null as any, // getMatrixRowDetail
      null as any, // getImpactGraph
      null as any, // getQaCoverage
      null as any, // getReviewQueue
      null as any, // getImpactDiff
      null as any, // getLineage
      getAnalysisDriftFreshness,
      getAnalysisWorkspace,
      permissions,
    );
  });

  it('throws 401 if unauthorized', async () => {
    permissions.assertCanReadAnalysis.mockRejectedValueOnce(new UnauthorizedException());
    await expect(controller.driftFreshness('proj-1', 'analysis-1', mockActor)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 404 if forbidden/cross-project', async () => {
    permissions.assertCanReadAnalysis.mockRejectedValueOnce(new NotFoundException());
    await expect(controller.driftFreshness('proj-1', 'analysis-1', mockActor)).rejects.toThrow(NotFoundException);
  });

  it('returns DriftFreshnessRecommendation', async () => {
    permissions.assertCanReadAnalysis.mockResolvedValueOnce(undefined);
    getAnalysisDriftFreshness.execute.mockResolvedValueOnce({
      status: 'CURRENT',
      severity: 'INFO',
      shouldReviewBeforeUse: false,
      shouldRerunAnalysis: false,
      reason: 'OK'
    });

    const result = await controller.driftFreshness('proj-1', 'analysis-1', mockActor);
    expect(result.status).toBe('CURRENT');
  });

  it('returns the analysis workspace read model', async () => {
    permissions.assertCanReadAnalysis.mockResolvedValueOnce(undefined);
    getAnalysisWorkspace.execute.mockResolvedValueOnce({
      overview: {
        analysisId: '00000000-0000-4000-8000-000000000001',
        requirement: {
          revisionId: '00000000-0000-4000-8000-000000000002',
          title: 'Refund API',
	          summary: 'Cancel paid bookings.',
	          language: 'en',
	          domainProfileId: 'booking@0.1.0',
	          domainPack: {
	            id: 'booking',
	            version: '0.1.0',
	            status: 'STABLE',
	            selectedBy: 'REPOSITORY_PROFILE',
	          },
	        },
        snapshot: {
          snapshotId: '00000000-0000-4000-8000-000000000003',
          repositoryId: '00000000-0000-4000-8000-000000000004',
          commitSha: 'abc123',
          analyzerVersion: 'nestjs-ts/0.1.0',
        },
        status: {
          analysisStatus: 'WAITING_FOR_REVIEW',
          reviewStatus: 'not_started',
          snapshotStatus: 'locked',
          reportStatus: 'missing',
          driftStatus: 'fresh',
        },
        counts: {
          impactedArtifacts: 0,
          evidenceItems: 0,
          risks: 0,
          unknowns: 0,
          qaScenarios: 0,
          pendingReviewItems: 0,
        },
      },
      impactGroups: [],
      evidenceCards: [],
      risks: [],
      unknowns: [],
      qaScenarios: [],
      reviewQueue: [],
      reportStatus: {
        status: 'missing',
        generatedDocumentId: null,
        documentJobId: null,
        reviewedReportSnapshotId: null,
        canExport: false,
        lastGeneratedAt: null,
        failureMessage: null,
      },
      driftStatus: {
        status: 'fresh',
        isStale: false,
        basis: 'latest_observed_source_target',
        sourceTargetId: '00000000-0000-4000-8000-000000000005',
        latestObservedCommitSha: 'abc123',
        snapshotCommitSha: 'abc123',
        reason: null,
      },
    });

    const result = await controller.workspace('analysis-1', mockActor);

    expect(permissions.assertCanReadAnalysis).toHaveBeenCalledWith(mockActor, 'analysis-1');
    expect(getAnalysisWorkspace.execute).toHaveBeenCalledWith('analysis-1');
    expect(result.overview.status.reportStatus).toBe('missing');
  });
});
