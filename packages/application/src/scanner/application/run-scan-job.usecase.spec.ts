import { RunScanJobUseCase } from './run-scan-job.usecase';
import type { ScanJobRunnerPort } from '../ports/scan-job-runner.port';

describe('RunScanJobUseCase', () => {
  it('delegates the command to the configured scan runner', async () => {
    const runner: ScanJobRunnerPort = {
      run: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new RunScanJobUseCase(runner);

    await useCase.execute({ jobId: 'job-1' });

    expect(runner.run).toHaveBeenCalledWith({ jobId: 'job-1' });
  });
});
