import { RunDocumentJobUseCase } from './run-document-job.usecase';
import type { DocumentJobRunnerPort } from '../ports/document-job-runner.port';

describe('RunDocumentJobUseCase', () => {
  it('delegates the command and returns the generated document identity', async () => {
    const runner: DocumentJobRunnerPort = {
      run: jest.fn().mockResolvedValue({
        success: true,
        generatedDocumentId: 'document-1',
      }),
    };
    const useCase = new RunDocumentJobUseCase(runner);

    await expect(
      useCase.execute({ documentJobId: 'document-job-1' }),
    ).resolves.toEqual({
      success: true,
      generatedDocumentId: 'document-1',
    });
  });
});
