import { ScanJobController } from './scan-job.controller';

describe('ScanJobController', () => {
  it('returns snapshotCoverageStatus when a snapshot is linked to the job', async () => {
    const controller = new ScanJobController(
      { execute: jest.fn() } as any,
      {
        findById: jest.fn().mockResolvedValue({
          id: '78ad80d0-f766-4526-bf26-fe9cb1cfe771',
          status: 'COMPLETED',
          stage: 'DONE',
          progress: 100,
          diagnostics: [],
          errorCode: null,
          errorMessage: null,
          sourceTargetId: '98b3fb02-9e83-47f2-9715-e2bd3e6cd111',
          snapshotId: 'da0df4d6-6986-43bd-90ff-2dad51e9ab77',
          snapshot: {
            coverageStatus: 'READY',
          },
          createdAt: new Date('2026-06-16T00:00:00.000Z'),
          updatedAt: new Date('2026-06-16T00:01:00.000Z'),
        }),
      } as any,
      {
        assertCanReadScanJob: jest.fn().mockResolvedValue(undefined),
      } as any,
      {} as any,
    );

    const result = await controller.get('scan-job-1', {
      id: 'user-1',
      email: 'admin@ba-helper.local',
      role: 'ADMIN',
    } as any);

    expect(result.result.snapshotCoverageStatus).toBe('READY');
  });
});
