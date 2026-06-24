import { Test, TestingModule } from '@nestjs/testing';
import { ImpactAnalysisReadModelController } from './impact-analysis-read-model.controller';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { GetAnalysisDriftFreshnessUseCase } from '../application/queries/get-analysis-drift-freshness.usecase';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@ba-helper/contracts';

describe('ImpactAnalysisReadModelController - driftFreshness', () => {
  let controller: ImpactAnalysisReadModelController;
  let permissions: jest.Mocked<ProjectPermissionService>;
  let getAnalysisDriftFreshness: jest.Mocked<GetAnalysisDriftFreshnessUseCase>;

  const mockActor: RequestUser = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'VIEWER' };

  beforeEach(async () => {
    permissions = {
      assertCanReadAnalysis: jest.fn(),
    } as any;

    getAnalysisDriftFreshness = {
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
});
